!!! source : cloné de https://github.com/blw-ofag-ufag/agricheck




AGRICHECK
=========

The current multitude of inspections in both the private and public sectors represents a significant administrative burden for farms in Switzerland. With over 5000 inspection points[^1] and more than 20 different inspection programs, the system lacks a user-friendly coordination. Existing processes are neither very digitized nor harmonized, leading to redundancies and inefficiencies for both farmers and authorities.

[^1]: Here, an inspection point is a specific, verifiable criterion within an agricultural control program used to assess a farm's compliance with a particular regulation or standard.

The goal of agricheck is to first collect and harmonize inspection points from both the private and public agricultural sector, and second to provide [a simple web application for farmers](https://blw-ofag-ufag.github.io/agricheck/) to quickly search and navigate these inspection points.

# The data

The data from various sources is standardized and freely provided in the RDF format via the linked data service LINDAS by the Federal Archive. [Here's an example example inspection point as a linked data object on LINDAS.](https://agriculture.ld.admin.ch/inspection/0A60DB5BD8144E25B550D03A3B176B66)

The data of agricheck is organized hierarchically.
Here are the links to the top-level collections:

- [Legal minimum](https://agriculture.ld.admin.ch/inspection/A07EF60442B92B978AAA3B546480A7C5)
- [Direct payments](https://agriculture.ld.admin.ch/inspection/A07EF60442B92B978BBB3B546480A7C5)
- [Labels](https://agriculture.ld.admin.ch/inspection/A07EF60442B92B978CCC3B546480A7C5)

# The data model

The data model was written using OWL, the web ontology language. It is not only used as a map to write queries, but also for a automatic reasoning process. [You can inspect the data model here.](https://service.tib.eu/webvowl/#iri=https://raw.githubusercontent.com/blw-ofag-ufag/agricheck/refs/heads/main/rdf/ontology.ttl)

# Run data integration pipeline

To run the data integration from excel or XML files to standardized RDF turtle files, do the following:

1. Add variables to `.env`

    ``` sh
    USER=lindas-foag
    PASSWORD=********
    GRAPH=https://lindas.admin.ch/foag/crops
    ENDPOINT=https://stardog.cluster.ldbar.ch/lindas
    ```

2. Add all relevant excel data sheets to the `/data` folder.
3. Start a virtual environment and install libraries:

    ``` sh
    python -m venv venv
    source venv/bin/activate  # On Windows use: venv\Scripts\activate
    pip install -r requirements.txt
    ```

4. Run the ETL pipeline

    ``` sh
    sh scripts/pipeline.sh
    ```

5. Check out the results on LINDAS.

Step 3 executes the R scripts for data conversion (`acontrol.R`, `bioinspecta.R` and `mutterkuh.R`...) as well as the data validation, reasoning and merging `validate-syntax.py` and `reason.py`.

# Cleaning duplicate descriptions

> [!NOTE]
> This feature is deactivated for now. Needs some revisions.

In the source data, some inspection points contain a `schema:description` value that is *nearly* identical to their `schema:name`.
Unfortunately, this is often the case for one language but not another, which leads to weird fallback langauge behavior. To fix this, the similarity is measured using the normalized Levenshtein distance, which computes the number of single-character edits (insertions, deletions, substitutions) needed to transform one string into the other.
The raw distance is then divided by the maximum string length, which makes the metric length-agnostic and comparable across strings of different sizes:

$$
\text{Normalized Levenshtein}(a, b) = \frac{\text{Levenshtein}(a, b)}{\max\left(\lvert a \rvert, \lvert b \rvert\right)}
$$

If the normalized distance between schema:name and schema:description is ≤ 0.1, the description is considered redundant and removed from the RDF graph.
This cleaning process is implemented in the Python script `scripts/remove-redundancy.py`, and the resulting graph is re-serialized to Turtle.

# Example queries

- [Get all inspection points with labels, comment and codes](https://s.zazuko.com/2kyE73x)
- [Find inspection point groups with exactly one sub-item](https://s.zazuko.com/32yA9Wd)
- [How many distinct inspection points are there under the public domain?](https://s.zazuko.com/2E3RsSk)
