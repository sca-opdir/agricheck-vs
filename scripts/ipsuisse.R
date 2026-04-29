# SET GLOBAL VARIABLES
# ====================

# attach libraries to search path
library(readxl)
library(rdfhelper) # download from https://github.com/damian-oswald/rdfhelper
library(rvest)
library(stringr)
library(dplyr)
library(tidyr)

# Define a cleaning function
# We use minimal_html to create a valid DOM, then extract text.
# We use tryCatch to handle NA or empty strings gracefully.
extract_clean_text <- function(html_string) {
  if (is.na(html_string) || html_string == "") return("")
  rvest::minimal_html(html_string) %>%
    html_text2()
}

# define RDF prefixes, bases etc.
base <- "https://agriculture.ld.admin.ch/inspection/"
prefixes <- "
@prefix : <https://agriculture.ld.admin.ch/inspection/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
"

# IP-Suisse already has an assigned URI; we re-use this one here
# This URI serves as the top-level node for all nodes processed hereafter
ipsuisse <- rdfhelper::uri("F3F3FF20CFC6FC66824039A46480AE10", base)
groups <- rdfhelper::uri(c(
  "F3F3FF20CFC6FC66824039A46480AE11",
  "F3F3FF20CFC6FC66824039A46480AE12",
  "F3F3FF20CFC6FC66824039A46480AE13"
), base)

# CREATE RDF GRAPH FROM DATA FRAME
# ================================

# loop trough each row, determine type and handle accordingly
sink("rdf/ipsuisse.ttl")

# Define all prefixes
cat(prefixes)

for(sheet in 1:3) {

  # Read Excel file from Bio.Inspecta
  data <- readxl::read_excel("data/ipsuisse.xlsx", skip = 0, sheet = sheet)
  if(sheet != 1) {
    data <- data[-1,]
  }

  # Clean text
  for (i in seq_len(nrow(data))) {
    for(lang in c("DE", "FR", "IT")) {
      data[i, sprintf("Anforderungen %s", lang)] <- data[i, sprintf("Anforderungen %s", lang)] %>%
        extract_clean_text() %>%
        str_squish()
    }
  }

  # Create an ID for each row in the data set
  data$URI <- NA
  for (i in 1:nrow(data)) {
    data[i,"URI"] <- rdfhelper::uri(toupper(rlang::hash(paste0(i, sheet))), base)
  }

  # Assign parents
  data <- data %>%
    mutate(
      scope_ueb1 = if_else(Typ == "Ueb1", URI, NA_character_),
      scope_immediate = if_else(Typ %in% c("Ueb1", "Ueb2"), URI, NA_character_)
    ) %>%
    fill(scope_ueb1, scope_immediate, .direction = "down") %>%
    mutate(
      parent = case_when(
        Typ == "Ueb1" ~ groups[sheet],
        Typ == "Ueb2" ~ scope_ueb1,
        Typ == "KP"   ~ scope_immediate,
        TRUE          ~ NA_character_
      )
    ) %>%
    select(-scope_ueb1, -scope_immediate)

  # Assign classes
  data$class <- ifelse(data$Typ=="KP", uri("InspectionPoint", base), uri("http://purl.org/dc/terms/Collection"))

  # Process each row in the data frame individually
  for (i in 1:nrow(data)) {

    # Save row data
    subject <- as.character(data[i, "URI"])
    class <- as.character(data[i, "class"])
    parent <- as.character(data[i, "parent"])

    # Process collections of inspection points
    rdfhelper::triple(subject, "a", class)

    # Add parent/inspection point group
    property <- ifelse(
      class=="<https://agriculture.ld.admin.ch/inspection/InspectionPoint>",
      "https://agriculture.ld.admin.ch/inspection/belongsToGroup",
      "http://schema.org/isPartOf")
    rdfhelper::triple(subject, uri(property), parent)

    # Assign the schema:identifier for the inspection point OR the inspection point collection
    # Note: this identifier comes from BioSuisse; it's a human-readable ID, not a global ID
    rdfhelper::triple(subject, "schema:identifier", literal(i))

    # Add name
    for(lang in c("DE", "FR", "IT")) {
      text <- as.character(data[i, sprintf("Anforderungen %s", lang)])
      rdfhelper::triple(subject, "schema:name", langstring(text, tolower(lang)))
    }
  }

}

sink()

