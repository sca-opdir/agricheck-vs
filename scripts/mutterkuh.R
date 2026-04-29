library(rdfhelper)
library(readxl)

# read data
data <- readxl::read_excel("data/mutterkuh.xlsx")

# define URI prefixes
base   <- "https://agriculture.ld.admin.ch/inspection/"
rdfs   <- "http://www.w3.org/2000/01/rdf-schema#"
schema <- "http://schema.org/"

# create file
sink("rdf/mutterkuh.ttl")

# loop over each row in excel table
for (i in seq_len(nrow(data))) {

  # define a URI based on hashed entry
  subject <- rdfhelper::uri(toupper(rlang::hash(data[i, 2])), base)

  # define class and parent
  rdfhelper::triple(subject, "a", rdfhelper::uri("InspectionPoint", base))
  rdfhelper::triple(
    subject = subject,
    predicate = rdfhelper::uri("belongsToGroup", prefix = base),
    object = rdfhelper::uri("84EA1092A8794BB0AFD2B7A486619C7G", prefix = base)
  )
  rdfhelper::triple(
    subject,
    rdfhelper::uri("identifier", schema),
    literal(sprintf("%03d", as.integer(data[i, "ID"])))
  )

  # give all the labels and comments
  for (property in c("name", "description")) {
    for (lang in c("de", "fr", "it")) {
      x <- as.character(data[i, paste(property, lang, sep = "_")])
      rdfhelper::triple(
        subject = subject,
        predicate = rdfhelper::uri(property, prefix = schema),
        object = rdfhelper::langstring(x, lang = lang)
      )
    }
  }
}

sink()
