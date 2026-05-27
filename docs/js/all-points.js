// Remplacez tout le contenu de votre fichier JS par ceci
import { parse } from 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';

const csvUrl = '../data/points_de_contrôle_2026-05-20_addedKeywords_embeddings_tsneviz.csv';

window.rebuildPage = async function(lang) {
    const bodyQuery = document.getElementById('resultsBodyQuery');
    const bodyCSV = document.getElementById('resultsBodyCSV');
    
    // Reset
    bodyQuery.innerHTML = '<tr><td colspan="4">Chargement SPARQL...</td></tr>';
    bodyCSV.innerHTML = '<tr><td colspan="4">Chargement CSV...</td></tr>';

    try {
        // 1. Chargement SPARQL
        const sparqlQuery = getQuery(lang);
        const response = await fetch("https://lindas.admin.ch/query?query=" + encodeURIComponent(sparqlQuery), {
            headers: { "Accept": "application/sparql-results+json" }
        });
        const data = await response.json();
        
        bodyQuery.innerHTML = '';
        data.results.bindings.forEach(row => {
            bodyQuery.innerHTML += `<tr>
                <td>${row.hierarchy.value}</td>
                <td>${row.code_full?.value || ''}</td>
                <td>${row.code?.value || ''}</td>
                <td>${row.label.value}</td>
            </tr>`;
        });

        // 2. Chargement CSV (Frozen)
        parse(csvUrl, {
            download: true,
            header: true,
            delimiter: ";",
            complete: function(results) {
                bodyCSV.innerHTML = '';
                results.data.forEach(item => {
                    bodyCSV.innerHTML += `<tr>
                        <td>${item.hierarchy || ''}</td>
                        <td>${item.code || ''}</td>
                        <td>${item.label || ''}</td>
                        <td><span class="badge bg-info">${item.Tags || item.tags || '-'}</span></td>
                    </tr>`;
                });
                if (typeof window.hideLoader === 'function') window.hideLoader();
            }
        });
    } catch (e) {
        console.error(e);
        bodyQuery.innerHTML = '<tr><td colspan="4" class="text-danger">Erreur de chargement</td></tr>';
    }
};

// Fonction helper (gardée ici pour que le module y accède)
function getQuery(lang) {
  return `PREFIX schema: <http://schema.org/> PREFIX : <https://agriculture.ld.admin.ch/inspection/> 
  SELECT (GROUP_CONCAT(?parentName; separator=" / ") AS ?hierarchy) ?code_full ?code ?label
  WHERE { VALUES ?lang { "${lang}" } ?point a :InspectionPoint ; schema:name ?label . FILTER(LANG(?label) = ?lang)
  OPTIONAL { ?point schema:identifier ?code } OPTIONAL { ?point :conjunctIdentifier ?code_full }
  ?point (:belongsToGroup|schema:isPartOf)+ ?parent . ?parent schema:name ?parentName . FILTER(LANG(?parentName) = ?lang)
  FILTER(?parent != ?point && STR(?parentName) != "BFCen" && STR(?parentName) != "BFC") } 
  GROUP BY ?point ?label ?code ?code_full ORDER BY ?hierarchy`;
}
