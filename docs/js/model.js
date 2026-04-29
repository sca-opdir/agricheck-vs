const ENDPOINT = 'https://cached.lindas.admin.ch/query';

function buildQuery() {
  return `
    PREFIX : <https://agriculture.ld.admin.ch/inspection/>
    PREFIX schema: <http://schema.org/>
    PREFIX dct: <http://purl.org/dc/terms/>
    SELECT DISTINCT ?item ?class ?name ?description ?parent ?identifier
    FROM <https://lindas.admin.ch/foag/inspections>
    WHERE
    {
      :42EA1020A8742ACABFB1B7A426619C42 schema:hasPart+ / :includesInspectionPoints* ?item .
      ?item a ?class .
      VALUES ?class { dct:Collection :InspectionPoint }
      OPTIONAL { ?item schema:name ?name }
      OPTIONAL { ?item schema:description ?description }
      # FILTER: Ensure name and description use the same language (if both exist)
      FILTER ( !BOUND(?name) || !BOUND(?description) || lang(?name) = lang(?description) )
      OPTIONAL {
        ?item ?link ?parent .
        VALUES ?link { schema:isPartOf :belongsToGroup }
      }
      OPTIONAL { ?item schema:identifier ?identifier }
    }
    ORDER BY ?identifier ?item
    `;
}

export async function fetchBindings() {
  const res  = await fetch(ENDPOINT, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/sparql-query',
      'Accept':       'application/sparql-results+json'
    },
    body: buildQuery()
  });
  if (!res.ok) {
    throw new Error(`SPARQL request failed: ${res.status} - ${res.statusText}`);
  }
  return res.json();
}

export function buildNodeMap(bindingsJson) {
  const rows = bindingsJson.results.bindings;
  const v = (row, key) => row[key]?.value;
  const l = (row, key) => row[key]?.['xml:lang'];

  const map = new Map();
  for (const row of rows) {
    const uri = v(row, 'item');
    if (!map.has(uri)) {
      map.set(uri, {
        uri,
        type: v(row, 'class').includes('Collection') ? 'Collection' : 'InspectionPoint',
        label:      {},
        comment:    {},
        identifier: v(row, 'identifier') || null,
        subGroups:        [],
        inspectionPoints: [],
        superGroup:  null,
        parentGroup: null
      });
    }
    const node = map.get(uri);
    if (v(row, 'name'))        node.label[l(row, 'name')] = v(row, 'name');
    if (v(row, 'description')) node.comment[l(row, 'description')] = v(row, 'description');
  }

  const processedLinks = new Set();
  for (const row of rows) {
    const uri    = v(row, 'item');
    const parent = v(row, 'parent');
    if (!parent) continue;

    const linkId = `${uri}->${parent}`;
    if (processedLinks.has(linkId)) continue;
    processedLinks.add(linkId);

    const node       = map.get(uri);
    const parentNode = map.get(parent);
    if (!node || !parentNode) continue;

    if (node.type === 'Collection') {
      node.superGroup = parent;
      if (!parentNode.subGroups.includes(uri)) parentNode.subGroups.push(uri);
    } else {
      node.parentGroup = parent;
      if (!parentNode.inspectionPoints.includes(uri)) parentNode.inspectionPoints.push(uri);
    }
  }
  return map;
}

export function getDescendantIPs(collectionURI, nodeMap, visited = new Set()) {
  if (visited.has(collectionURI)) return [];
  visited.add(collectionURI);

  const node = nodeMap.get(collectionURI);
  if (!node || node.type !== 'Collection') return [];

  let ips = [...node.inspectionPoints];
  for (const sub of node.subGroups) {
    ips = ips.concat(getDescendantIPs(sub, nodeMap, visited));
  }
  return ips;
}

export function getBreadcrumbs(uri, nodeMap) {
  const trail = [];
  let cur = uri;
  while (cur) {
    const n = nodeMap.get(cur);
    if (!n) break;
    trail.unshift(n.label || cur.split('/').pop());
    cur = n.superGroup || n.parentGroup;
  }
  return trail;
}
