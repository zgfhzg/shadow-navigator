"""Read only highway topology from Geofabrik's complete Hong Kong extract."""
import osmium,json,hashlib,datetime
from pathlib import Path
root=Path(__file__).resolve().parent.parent
source=root/'data/hong-kong-latest.osm.pbf'
class Roads(osmium.SimpleHandler):
 def __init__(self):
  super().__init__();self.nodes={};self.tags={};self.ways=[];self.restrictions=[]
 def node(self,n):
  tags=dict(n.tags)
  if any(k in tags for k in ('barrier','access','foot','bicycle','level','highway')) or any(k.endswith(':conditional') for k in tags):self.tags[n.id]=tags
 def way(self,w):
  tags=dict(w.tags)
  if 'highway' not in tags:return
  ids=[]
  for n in w.nodes:
   if not n.location.valid():raise ValueError('Missing node location in full extract')
   ids.append(n.ref);self.nodes[n.ref]={'type':'node','id':n.ref,'lon':n.lon,'lat':n.lat,'tags':self.tags.get(n.ref,{})}
  self.ways.append({'type':'way','id':w.id,'nodes':ids,'tags':tags})
 def relation(self,r):
  if r.tags.get('type')=='restriction':self.restrictions.append({'type':'relation','id':r.id,'tags':dict(r.tags)})
h=Roads();h.apply_file(str(source),locations=True)
with osmium.io.Reader(str(source)) as reader:timestamp=reader.header().get('osmosis_replication_timestamp')
result={'version':0.6,'elements':list(h.nodes.values())+h.ways+h.restrictions,'osm3s':{'timestamp_osm_base':timestamp},'shadowDownload':{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'provider':'Geofabrik','url':'https://download.geofabrik.de/asia/china/hong-kong.html','bounds':[113.81,22.14,114.46,22.57],'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}}
(root/'data/hongkong-full.osm.json').write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False))
print(json.dumps({'nodes':len(h.nodes),'ways':len(h.ways),'timestamp':timestamp}))
