// import * as hlib from '../../hlib/hlib'; // this will be commented out in the shipping bundle
var worker = new Worker('showAnnotation.js');
worker.addEventListener('message', function (e) {
    try {
        var elt = hlib.getById(`cards_counter_${e.data.id}`);
        elt.innerHTML += e.data.output;
    }
    catch (e) {
        console.log(e);
    }
});
var params = decodeURIComponent(hlib.gup('params'));
params = JSON.parse(params);
var widget = hlib.getById('widget');
var controlsContainer = hlib.getById('controlsContainer');
var format = params['format'];
delete params['format'];
if (format === 'html') {
    controlsContainer.innerHTML = `<button onclick="hlib.expandAll()">expand all</button>
     <button onclick="hlib.collapseAll()">collapse all</button>
     <button onclick="downloadHTML()">download HTML</button>`
} else if (format === 'csv') {
  controlsContainer.innerHTML = '<button onclick="downloadCSV()">download CSV</button>'
} else {
  controlsContainer.innerHTML = '<button onclick="downloadJSON()">download JSON</button>'
}
Object.keys(params).forEach(function (key) {
    if (params[key] === '') {
        delete params[key];
    }
    if (params['group'] && params['group'] === '__world__') {
        delete params['group'];
    }
});
document.getElementById('title').innerHTML = `Hypothesis query: ${JSON.stringify(params)} &nbsp; <span id="progress"></span>`;
var nonEmptyParams = Object.values(params).filter(x => x != '');
if (nonEmptyParams.length == 0) {
    params.max = 400;
}
hlib.hApiSearch(params, processSearchResults, 'progress');
function processSearchResults(annos, replies) {
    var csv = '';
    var json = [];
    var gathered = hlib.gatherAnnotationsByUrl(annos);
    var reversedUrls = reverseChronUrls(gathered.urlUpdates);
    var counter = 0;
    reversedUrls.forEach(function (url) {
        counter++;
        var perUrlId = counter;
        var perUrlCount = 0;
        var idsForUrl = gathered.ids[url];
        idsForUrl.forEach(function (id) {
            perUrlCount++;
            var _replies = hlib.findRepliesForId(id, replies);
            var all = [gathered.annos[id]].concat(_replies);
            all.forEach(function (anno) {
                var level = 0;
                if (anno.refs) {
                    level = anno.refs.length;
                }
                if (format === 'html') {
                    worker.postMessage({
                        perUrlId: perUrlId,
                        anno: anno,
                        annoId: anno.id,
                        level: level
                    });
                }
                else if (format === 'csv') {
                    var _row = document.createElement('div');
                    _row.innerHTML = hlib.csvRow(level, anno);
                    csv += _row.innerText + '\n';
                }
                else if (format === 'json') {
                    anno.text = anno.text.replace(/</g, '&lt;');
                    json.push(anno);
                }
            });
        });
        if (format === 'html') {
            showUrlResults(counter, 'widget', url, perUrlCount, gathered.titles[url]);
        }
    });
    if (format === 'csv') {
        widget.style['white-space'] = 'pre';
        widget.style['overflow-x'] = 'scroll';
        widget.innerText = csv;
    }
    else if (format === 'json') {
        widget.style['white-space'] = 'pre';
        widget.innerText = JSON.stringify(json, null, 2);
    }
    hlib.getById('progress').innerHTML = '';
    setTimeout(function () {
        hlib.collapseAll();
        widget.style.display = 'block';
    }, 500);
}
function showUrlResults(counter, eltId, url, count, doctitle) {
    var urlResultsId = `counter_${counter}`;
    var output = `<h1 id="heading_${urlResultsId}" class="urlHeading">
    <a title="collapse" href="javascript:hlib.toggle('${urlResultsId}')"> <span class="toggle">-</span></a>
    <span class="counter">&nbsp;${count}&nbsp;</span>
   <a title="visit annotated page" target="annotatedPage" href="https://hyp.is/go?url=${url}">${doctitle}</a> 
   </h1>
   <div id="cards_${urlResultsId}">
   </div>`;
    hlib.getById(eltId).innerHTML += output;
}
function reverseChronUrls(urlUpdates) {
    var reverseChronUrls = [];
    for (var urlUpdate in urlUpdates) { // sort urls in reverse chron of recent update
        reverseChronUrls.push([urlUpdate, urlUpdates[urlUpdate]]);
    }
    reverseChronUrls.sort(function (a, b) {
        return new Date(b[1]) - new Date(a[1]);
    });
    return reverseChronUrls.map(item => item[0]);
}
function downloadHTML() {
    var html = `
<html>
${document.head.outerHTML}
${document.body.outerHTML}
</html>`;
    hlib.download(html, 'html');
}
function downloadCSV() {
    var csvOutput = '"level","updated","url","user","id","group","tags","quote","text","direct link"\n';
    csvOutput += widget.innerText;
    hlib.download(csvOutput, 'csv');
}

function downloadJSON () {
  var jsonOutput = '[' + widget.innerText + ']'
  hlib.download(jsonOutput, 'json')
}
