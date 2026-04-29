from rdflib import Graph, Namespace, URIRef, Literal
from Levenshtein import distance as levenshtein
import sys

datafile = "rdf/graph.ttl"
outfile = "rdf/graph.ttl"

SCHEMA = Namespace("http://schema.org/")
EX = Namespace("https://agriculture.ld.admin.ch/inspection/")

g = Graph()
g.parse(datafile, format="turtle")

query = """
PREFIX : <https://agriculture.ld.admin.ch/inspection/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX schema: <http://schema.org/>
SELECT DISTINCT ?uri ?name ?description
WHERE {
  :42EA1020A8742ACABFB1B7A426619C42
    schema:hasPart+/:includesInspectionPoints* ?uri .
  ?uri schema:name ?name ;
       schema:description ?description .
  FILTER(LANG(?name)=LANG(?description))
}
"""

results = g.query(query)
to_remove = []
for row in results:
    uri, name, desc = row

    if not (isinstance(name, Literal) and isinstance(desc, Literal)):
        continue

    lv = levenshtein(str(name), str(desc))
    norm_lv = lv / max(len(str(name)), len(str(desc)))

    if norm_lv <= 0.05:
        print(
          f"Remove schema:description from {uri} (Levenshtein distance = {norm_lv:.3f})",
          f"Name:        '{name}'",
          f"Description: '{desc}'",
          "\n", sep="\n"
        )
        to_remove.append((uri, SCHEMA.description, desc))

for triple in to_remove:
    g.remove(triple)

g.serialize(destination=outfile, format="turtle")
