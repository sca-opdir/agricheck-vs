# libraries
library(rdfhelper) # from https://github.com/Damian-Oswald/rdfhelper
library(cld2)
library(xml2)
library(purrr)
library(dplyr)
library(stringr)

# helper functions
source("scripts/helpers.R")

# define RDF prefixes, bases etc.
base <- "https://agriculture.ld.admin.ch/inspection/"
prefixes <- "
@prefix : <https://agriculture.ld.admin.ch/inspection/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
"

# read Acontrol XML
url <- "https://www.blw.admin.ch/dam/de/sd-web/KDcHFyWZPHes/Masterliste%202026.zip" #nolint
temp_zip <- tempfile(fileext = ".zip")
unzip_dir <- tempdir()
download.file(url, temp_zip, mode = "wb")
unzip(temp_zip, exdir = unzip_dir)
xml_file_path <- file.path(unzip_dir, "Masterliste 2026.xml")
XML <- read_xml(xml_file_path)
rm(xml_file_path, url, temp_zip, unzip_dir)

# HELPER FUNCTIONS
# ================

# function to convert one [thing] description
describe <- function(x, class, relationPredicate = "schema:isPartOf") {
  subject <- x |> getElement("versionStableId") |> unlist() |> uri(base)
  triple(subject, "a", uri(class))
  for (lang in c("De", "Fr", "It"))
  {
    elementShortName <- x |> getElement("elementShortName") |>
      getElement(paste0("name", lang)) |>
      unlist()
    elementName <- x |> getElement("elementName") |>
      getElement(paste0("name", lang)) |>
      unlist()
    elementShortName |>
      langstring(tolower(lang), multiline = FALSE) |>
      triple(subject, "schema:name", object = _)
    if(!is.na(elementName) && length(elementName)>0 && (elementName != elementShortName))
    {
      elementName |>
        langstring(tolower(lang), multiline = TRUE) |>
        triple(subject, "schema:description", object = _)
    }
  }

  x |>
    getElement("parentVersionStableId") |>
    unlist() |>
    uri(prefix = base) |>
    triple(subject, relationPredicate, object = _)
  x |>
    getElement("elementId") |>
    unlist() |>
    cleanIdentifier() |>
    literal() |>
    triple(subject, "schema:identifier", object = _)
  x |>
    getElement("conjunctElementId") |>
    unlist() |>
    literal() |>
    triple(subject, uri("conjunctIdentifier", base), object = _)
}

# convert (a part of the XML) to an R list for quicker processing
xml_to_list <- function(XML, xpath) {
  XML |>
    xml_find_all(xpath) |>
    as_list()
}

# PARSE RUBRICS
# =============

sink("rdf/acontrol.ttl")

cat(prefixes)

# convert XML to R list containing all data
data <- xml_to_list(XML, "//rubric")

# convert all rubrics
for (i in 1:length(data)) {
  data[[i]][["description"]] |>
    describe(class = "http://purl.org/dc/terms/Collection")
}

# PARSE GROUPS
# =============

# convert XML to R list containing all data
data <- xml_to_list(XML, "//group")

# convert all rubrics
for (i in 1:length(data)) {
  data[[i]][["description"]] |>
    describe(class = "http://purl.org/dc/terms/Collection")
}

# PARSE INSPECTION POINTS
# =======================

# convert XML to R list containing all data
data <- xml_to_list(XML, "//point")

# convert all rubrics
for (i in 1:length(data)) {
  data[[i]][["description"]] |>
    describe(class = "https://agriculture.ld.admin.ch/inspection/InspectionPoint", relationPredicate = ":belongsToGroup")
}


# PARSE POSSIBLE DEFECTS
# ======================

# function to convert a string to a valid URI
hashURI <- function(x, base)
{
  rdfhelper::uri(toupper(rlang::hash(x)), prefix = base)
}

# function to convert one [thing] description
describe_PossibleOutcome <- function(x) {

  # create a blank node for this possible outcome
  subject <- x |> getElement("versionStableId") |> unlist() |> paste0("_:", x = _)

  # save IRIs for inspection point, defect and sanction
  InspectionPoint <- x |> getElement("parentVersionStableId") |> unlist() |> uri(base)
  Defect <- unlist(x[["nameDe"]]) |> hashURI(base)
  Sanction <- x |> getElement("suggestedSanction") |> getElement("nameDe") |> unlist() |> hashURI(base)

  # make statements about possible outcome
  triple(subject, "a", uri("PossibleOutcome", base))

  triple(subject, uri("defect", base), Defect)
  triple(Defect, uri("possibleOutcome", base), subject)

  triple(subject, uri("suggestedSanction", base), Sanction)
  triple(Sanction, uri("possibleOutcome", base), subject)

  triple(subject, uri("inspectionPoint", base), InspectionPoint)
  triple(InspectionPoint, uri("possibleOutcome", base), subject)
}

# Function to describe one defect and give it an URI
# - Defects in the XML are used strictly hierarchical, which creates redundant information.
# - To reduce redundancy, we introduce two new classes: :Defect and :Sanction
describe_Defect <- function(x) {
  subject <- hashURI(x, base)
  rdfhelper::triple(subject, "a", ":Defect")
  for (lang in c("De", "Fr", "It"))
  {
    x |> getElement(paste0("name", lang)) |>
      unlist() |>
      rdfhelper::langstring(lang = tolower(lang)) |>
      triple(subject, "schema:name", object = _)
  }
}

describe_Sanction <- function(x) {
  subject <- x |> getElement("suggestedSanction") |> hashURI(base)
  rdfhelper::triple(subject, "a", ":Sanction")
  for (lang in c("De", "Fr", "It"))
  {
    x |>
      getElement("suggestedSanction") |>
      getElement(paste0("name", lang)) |>
      unlist() |>
      rdfhelper::langstring(lang = tolower(lang)) |>
      triple(subject, "schema:name", object = _)
  }
}


data <- xml_to_list(XML, "//possibleDefect")
for (i in 1:length(data)) {
  data[[i]] |>
    describe_PossibleOutcome()
  data[[i]] |>
    describe_Sanction()
  data[[i]] |>
    describe_Defect()
}

sink()

