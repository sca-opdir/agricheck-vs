const query = `
PREFIX schema: <http://schema.org/>
PREFIX : <https://agriculture.ld.admin.ch/inspection/>
SELECT (GROUP_CONCAT(?parentName; separator=" / ") AS ?hierarchy) ?code_full ?code ?label
WHERE {
  VALUES ?lang { "fr" }
  ?point a :InspectionPoint ; schema:name ?label .
  FILTER(LANG(?label) = ?lang)
  OPTIONAL { ?point schema:identifier ?code }
  OPTIONAL { ?point :conjunctIdentifier ?code_full }
  ?point (:belongsToGroup|schema:isPartOf)+ ?parent .
  ?parent schema:name ?parentName .
  FILTER(LANG(?parentName) = ?lang)
  FILTER(?parent != ?point && STR(?parentName) != "BFCen" && STR(?parentName) != "BFC")
}
GROUP BY ?point ?label ?code ?code_full
ORDER BY ?hierarchy`;

async function loadAllPoints() {
  const url = "https://lindas.admin.ch/query"; // Endpoint LINDAS
  const response = await fetch(`${url}?query=${encodeURIComponent(query)}`, {
    headers: { "Accept": "application/sparql-results+json" }
  });
  const data = await response.json();
  const tbody = document.getElementById('resultsBody');

  data.results.bindings.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="small text-muted">${row.hierarchy.value}</td>
      <td><strong>${row.code_full?.value || ''}</strong></td>
      <td>${row.code?.value || ''}</td>
      <td>${row.label.value}</td>
    `;
    tbody.appendChild(tr);
  });
}

loadAllPoints();


document.querySelectorAll('.column-filter').forEach(input => {
    input.addEventListener('keyup', function() {
        const table = document.getElementById('resultsTable');
        const rows = table.querySelector('tbody').rows;
        const filterValues = Array.from(document.querySelectorAll('.column-filter')).map(i => i.value.toLowerCase());

        for (const row of rows) {
            let isVisible = true;
            
            // On vérifie chaque colonne pour laquelle il y a un filtre
            filterValues.forEach((val, index) => {
                if (val && !row.cells[index].innerText.toLowerCase().includes(val)) {
                    isVisible = false;
                }
            });

            row.style.display = isVisible ? '' : 'none';
        }
    });
});
