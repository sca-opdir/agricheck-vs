# SET GLOBAL VARIABLES
# ====================

# attach libraries to search path
library(readxl)
library(rdfhelper) # download from https://github.com/damian-oswald/rdfhelper
library(stringr)


# define RDF prefixes, bases etc.
base <- "https://agriculture.ld.admin.ch/inspection/"

# READ AND PRE-PROCESS DATA FRAME
# ===============================

# Read Excel file from SwissGAP
data <- readxl::read_excel("data/sga-manual.xlsx")

# open new RDF file
sink("rdf/sga.ttl", append = TRUE)

# loop through table and convert to RDF
for (i in seq_len(nrow(data))) {

  # save current URI
  uri <- rdfhelper::uri(data[i, "ID"], base)

  # determine class of the current row
  class <- ifelse(
    data[i, "type"] == "point",
    uri("InspectionPoint", base),
    uri("Collection", "http://purl.org/dc/terms/")
  )

  # class statement
  rdfhelper::triple(uri, "a", class)

  for (lang in c("de", "fr", "it")) {
    for(variable in c("label_", "comment_")) {
      x <- data[i, paste0(variable, lang)]
      predicate <- ifelse(
        variable == "label_",
        "http://schema.org/name",
        "http://schema.org/description"
      )
      rdfhelper::triple(uri, rdfhelper::uri(predicate), langstring(x, lang))
    }
  }

  # parent statement
  rdfhelper::triple(
    uri,
    uri("http://schema.org/isPartOf"),
    rdfhelper::uri(data[i, "parent_id"], base)
  )
}

sink()
