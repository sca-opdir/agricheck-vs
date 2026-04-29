library(rdfhelper)
library(readxl)

# read data
data <- readxl::read_excel("data/qm.xlsx")

# define URI prefixes
base   <- "https://agriculture.ld.admin.ch/inspection/"
rdfs   <- "http://www.w3.org/2000/01/rdf-schema#"
schema <- "http://schema.org/"
dct    <- "http://purl.org/dc/terms/"

# create file
sink("rdf/qm.ttl")

# loop over each row in excel table
for (i in 1:nrow(data)) {
  # define a URI based on hashed entry
  subject <- rdfhelper::uri(toupper(rlang::hash(data[i,])), base)

  # define a URI for the parent
  parent <- rdfhelper::uri(toupper(rlang::hash(data[i,1:2])), base)

  # describe parent
  rdfhelper::triple(parent,  "a",                                          uri("Collection", dct))
  rdfhelper::triple(parent,  rdfhelper::uri("name", schema),               langstring(data[[1]][i], "de"))
  rdfhelper::triple(parent,  rdfhelper::uri("name", schema),               langstring(data[[2]][i], "fr"))
  rdfhelper::triple(parent,  rdfhelper::uri("isPartOf", prefix = schema),  rdfhelper::uri("84EA0583A8534BB0AFDC27A486652C3C", prefix = base))

  # define class and parent
  rdfhelper::triple(subject, "a", rdfhelper::uri("InspectionPoint", base))
  rdfhelper::triple(subject, rdfhelper::uri("belongsToGroup", prefix = base), parent)
  rdfhelper::triple(subject, rdfhelper::uri("identifier", schema), rdfhelper::literal(data[["identifier"]][i]))

  # give all the labels and comments
  for (property in c("name", "description"))
  {
    for (lang in c("de", "fr"))
    {
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
