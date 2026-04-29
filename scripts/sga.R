# SET GLOBAL VARIABLES
# ====================

# attach libraries to search path
library(readxl)
library(rdfhelper) # download from https://github.com/damian-oswald/rdfhelper
library(stringr)


# define RDF prefixes, bases etc.
base <- "https://agriculture.ld.admin.ch/inspection/"

# Helper function to get slug of ID
parse_identifier <- function(x)
{
  x <- strsplit(x, "\\.") |> unlist() |> as.integer()
  list(
    x     = x,
    slug  = tail(x, 1),
    level = 3-sum(x==0)
  )
}

# READ AND PRE-PROCESS DATA FRAME
# ===============================

# Read Excel file from SwissGAP
data <- readxl::read_excel("data/sga.xlsx", range = readxl::cell_cols("A:D"), skip = 0)

# Re-assign column names
colnames(data) <- c("id", "de", "fr", "it")

# Create an ID for each row in the data set
data$URI <- NA
for (i in 1:nrow(data))
{
  data[i,"URI"] <- rdfhelper::uri(toupper(rlang::hash(paste0("SwisseGarantie",data[i,"id"]))), base)
}

# Assign a code that allows quick search of a parent
data$code <- NA
for (i in 1:nrow(data))
{
  x <- parse_identifier(as.character(data[i,"id"]))
  data[i,"code"] <- paste(x$x[1:x$level], collapse = ".")
}

# Determine the parent of each point
data$parent <- NA
for (i in 1:nrow(data)) {

  # Use reg-ex to define parent code
  # (Each code is showing the hierarchy; e.g. object with code `1.2.3` has parent with code `1.2`)
  parent_code <- sub("\\.[^.]*$", "", data[i,"code"])

  # Search for the parents URI and insert it
  data[i,"parent"] <- as.character(subset(data, code==parent_code, select = URI))
}

# Save SwissGAP IRI
swissgap <- rdfhelper::uri("B3A2CF324826FC66839483546480AE24", prefix = base)

# open new RDF file
sink("rdf/sga.ttl")

# loop through table and convert to RDF
for (i in 1:nrow(data)) {

  # save current URI
  uri <- as.character(data[i,"URI"])

  # if the identifier slug is 0, it's a collection of inspection points
  level <- parse_identifier(as.character(data[i,"id"]))$level

  # determine class of the current row
  class <- ifelse(level==3, uri("InspectionPoint", base), uri("Collection", "http://purl.org/dc/terms/"))

  # class statement
  rdfhelper::triple(uri, "a", class)
  for (lang in c("de", "fr", "it"))
  {
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
  if (level == 1)
  {
    rdfhelper::triple(uri, uri("http://schema.org/isPartOf"), swissgap)
  }
  else if (level == 2)
  {
    rdfhelper::triple(uri, uri("http://schema.org/isPartOf"), as.character(data[i,"parent"]))
  }
  else if (level ==3)
  {
    rdfhelper::triple(uri, uri("belongsToGroup", base), as.character(data[i,"parent"]))
  }
}

sink()
