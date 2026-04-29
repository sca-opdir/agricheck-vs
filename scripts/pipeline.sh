#!/bin/bash

# Load environment variables from .env file
. ./.env

# Run R preprocessing steps
for r in acontrol bioinspecta mutterkuh qm swissgap sga sga-manual ipsuisse; do
  Rscript "scripts/${r}.R"
done

# Process RDF files using Python scrips
python3 scripts/validate-syntax.py
python3 scripts/reason.py rdf/{ontology,bioinspecta,mapping,acontrol,mutterkuh,qm,swissgap,sga,ipsuisse}.ttl
#python3 scripts/remove-redundancy.py
python3 scripts/validate-shape.py

# Delete existing data from LINDAS
curl \
  --user $USER:$PASSWORD \
  -X DELETE \
  "$ENDPOINT?graph=$GRAPH"

# Upload graph.ttl to LINDAS 
curl \
  --user $USER:$PASSWORD \
  -X POST \
  -H "Content-Type: text/turtle" \
  --data-binary @rdf/graph.ttl \
  "$ENDPOINT?graph=$GRAPH"
echo "LINDAS graph upload completed"
