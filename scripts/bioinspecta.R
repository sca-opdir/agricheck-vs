# SET GLOBAL VARIABLES
# ====================

# attach libraries to search path
library(readxl)
library(rdfhelper) # download from https://github.com/damian-oswald/rdfhelper

# define RDF prefixes, bases etc.
base <- "https://agriculture.ld.admin.ch/inspection/"
prefixes <- "
@prefix : <https://agriculture.ld.admin.ch/inspection/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
"

# Define language codes used in the headers of the excel data
language_codes <- c("DE-CH", "FR-CH", "IT-CH")

# BioSuisse already has an assigned URI; we re-use this one here
# This URI serves as the top-level node for all nodes processed hereafter
biosuisse <- rdfhelper::uri("A3B3FF82CFC6FC6683E03B546480AE08", base)


# READ AND PRE-PROCESS DATA FRAME
# ===============================

# Read Excel file from Bio.Inspecta
data <- readxl::read_excel("data/bioinspecta.xlsx", skip = 1)

# Subset only two "classes"
data <- subset(data, subset = data$Art %in% c("Kategorie", "CheckPunkt"))

# Create an ID for each row in the data set
data$URI <- NA
for (i in 1:nrow(data)) {
  data[i,"URI"] <- rdfhelper::uri(toupper(rlang::hash(data[i,"Code"])), base)
}

# Determine the parent of each point
data$parent <- NA
for (i in 1:nrow(data)) {

  # Use reg-ex to define parent code
  # (Each code is showing the hierarchy; e.g. object with code `1.2.3` has parent with code `1.2`)
  parent_code <- sub("\\.[^.]*$", "", data[i,"Code"])

  # Search for the parents URI and insert it
  data[i,"parent"] <- as.character(subset(data, Code==parent_code, select = URI))
}

# Replace all invalid parents with the BioSuisse URI
# (they are invalid because within the BioSuisse data set, no top level parent is defined)
data[data$parent=="character(0)","parent"] <- biosuisse

# create new variable for unified `Text` and `Beschreibung`
for (lang in language_codes) {
   data[[paste(lang, "Description")]] <- NA
}

# Remove all duplicate titles, comments etc.
# Often, the comment duplicates what is written in the title.
# This is better avoided by just leaving said cell empty (NA)
for (i in 1:nrow(data))
{
  for (lang in language_codes)
  {
    # keep track of what came "before"
    for (var in c("Bezeichnung", "Text", "Beschreibung"))
    {
      # construct the current variables name
      varname <- paste(lang, var)

      # read the string in a given cell
      string <- as.character(data[i,varname])

    }

    # create unified variable
    a <- as.character(data[i,paste(lang, "Text")])
    b <- as.character(data[i,paste(lang, "Beschreibung")])

    data[[paste(lang, "Description")]][i] <- paste(ifelse(is.na(a), "", a), ifelse(is.na(b), "", b)) |>
      trimws()

  }
}

# CREATE RDF GRAPH FROM DATA FRAME
# ================================

# loop trough each row, determine type and handle accordingly
sink("rdf/bioinspecta.ttl")

# Define all prefixes
cat(prefixes)

# State something about the provenience of the used data
rdfhelper::triple(biosuisse, "a", uri("http://purl.org/dc/terms/Collection"))

# Process each row in the data frame individually
for (i in 1:nrow(data))
{

  # Save subject IRI as `subject`
  subject <- as.character(data[i,"URI"])

  # Process collections of inspection points
  if (as.character(data[i,"Art"]) == "Kategorie")
  {

    # State class of the collection
    rdfhelper::triple(subject, "a", uri("http://purl.org/dc/terms/Collection"))

    # Assign a new parent for subsequent use
    collection <- subject

    # State the parent of this specific collection
    # (The parent was computed earlier already)
    rdfhelper::triple(subject, "schema:isPartOf", as.character(data[i,"parent"]))
  }

  # process individual inspection points
  else
  {
    # State class and group belonging
    rdfhelper::triple(subject, "a", uri("InspectionPoint", base))
    rdfhelper::triple(subject, uri("belongsToGroup", base), collection)
  }

  # Assign the schema:identifier for the inspection point OR the inspection point collection
  # Note: this identifier comes from BioSuisse; it's a human-readable ID, not a global ID
  rdfhelper::triple(subject, "schema:identifier", literal(as.character(data[i,"Code"])))

  # Generate all labels and comments.
  # (Note that some objects have two comments for some reason...)
  for (variable in c("Bezeichnung", "Description"))
  {
    for (lang in language_codes) {
      varname <- paste(lang, variable)

      # read and clean the content of a cell
      string <- data[i, varname] |>
        as.character() |>
        gsub(pattern = "[\r\n]", replacement = " ", x = _) |> # remove any newline or carriage commands
        gsub(pattern = "\\s+", replacement = " ", x = _) |> # replace any sequence of white spaces by one single white space
        gsub(pattern = "\\s+$", replacement = "", x = _) # remove any trailing white spaces

      # generate the triple statement
      rdfhelper::triple(
        subject = subject,
        predicate = ifelse(variable=="Bezeichnung", "schema:name", "schema:description"),
        object = langstring(string, tolower(substr(lang, 1, 2)))
      )
    }
  }
}
sink()

