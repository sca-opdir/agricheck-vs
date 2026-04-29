# SET GLOBAL VARIABLES
# ====================

# attach libraries to search path
library(readxl)
library(rdfhelper) # download from https://github.com/damian-oswald/rdfhelper
library(stringr)


# define RDF prefixes, bases etc.
base <- "https://agriculture.ld.admin.ch/inspection/"

# Save SwissGAP IRI
swissgap <- rdfhelper::uri("B3A2CF324826FC66839483546480AE12", prefix = base)


# READ AND PRE-PROCESS DATA FRAME
# ===============================

# Read Excel file from SwissGAP
data <- readxl::read_excel("data/swissgap.xlsx", range = readxl::cell_cols("C:F"), skip = 0)

# Re-assign column names
colnames(data) <- c("level", "de", "fr", "it")

# Assign an ID based on the Excel order
data$id <- 1:nrow(data)

# convert hierarchy to int
data$level <- as.integer(data$level)

# Create an ID for each row in the data set
data$URI <- NA
for (i in 1:nrow(data)) {
  data[i,"URI"] <- rdfhelper::uri(toupper(rlang::hash(paste0("SwissGAP_", data[i,"id"]))), base)
}

# Determine the parent of each point
data$parent <- NA
for(i in seq_len(nrow(data))) {

  if (data$level[i]==1) {
    data$parent[i] <- swissgap
    one <- data$URI[i]
  } else if(data$level[i]==2) {
    data$parent[i] <- one
    two <- data$URI[i]
  } else if(data$level[i]==3) {
    data$parent[i] <- two
  }
}

# open new RDF file
sink("rdf/swissgap.ttl")

# loop through table and convert to RDF
for (i in 1:nrow(data)) {

  # save current URI
  uri <- as.character(data[i, "URI"])

  level <- data$level[i]

  # determine class of the current row
  class <- ifelse(level==3, uri("InspectionPoint", base), uri("Collection", "http://purl.org/dc/terms/"))

  # class statement
  rdfhelper::triple(uri, "a", class)
  for (lang in c("de", "fr", "it")) {
    x <- as.character(data[i,lang])
    if (x == stringr::str_to_upper(x))
    {
      # convert to lowercase with uppercase start *if* it's all uppercase
      x <- stringr::str_to_sentence(x)
    }
    rdfhelper::triple(uri, uri("http://schema.org/name"), langstring(x,lang))
  }

  # identifier
  rdfhelper::triple(uri, uri("http://schema.org/identifier"), literal(as.character(data[i,"id"])))

  # parent statement
  if (level == 3) {
    rdfhelper::triple(uri, uri("belongsToGroup", base), as.character(data[i,"parent"]))
  } else {
    rdfhelper::triple(uri, uri("http://schema.org/isPartOf"), as.character(data[i,"parent"]))
  }
}

sink()
