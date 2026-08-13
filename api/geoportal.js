import proj4 from 'proj4'

const EPSG2180='+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs'
proj4.defs('EPSG:2180',EPSG2180)

const SERVICES={
 ortho:'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution',
 egib:'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow',
 utilities:'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu',
 mpzp:'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaMiejscowychPlanowZagospodarowaniaPrzestrzennego'
}
const preferred={ortho:['Raster'],egib:['dzialki','numery_dzialek','budynki','kontury','uzytki'],utilities:[],mpzp:[]}
async function layerNames(service,type){
 if(type==='ortho'||type==='egib')return preferred[type]
 const response=await fetch(service+'?SERVICE=WMS&REQUEST=GetCapabilities')
 const xml=await response.text(),names=[...xml.matchAll(/<(?:\w+:)?Name>([^<]+)<\/(?:\w+:)?Name>/g)].map(m=>m[1]).filter(n=>!/^WMS$/i.test(n))
 if(preferred[type].length)return preferred[type].filter(n=>names.includes(n)).length?preferred[type].filter(n=>names.includes(n)):names.slice(1,8)
 return names.slice(1,8)
}
export default async function handler(req,res){
 try{
  const {type,lat,lon}=req.query
  const y=Number(lat),x=Number(lon)
  if(!Number.isFinite(x)||!Number.isFinite(y))return res.status(400).json({error:'Nieprawidłowe współrzędne'})
  if(type==='parcel'){
   const url=`https://uldk.gugik.gov.pl/?request=GetParcelByXY&xy=${x},${y},4326&result=id,parcel,voivodeship,county,commune,region,datasource,geom_wkt&srid=4326`
   const response=await fetch(url),text=await response.text()
   const lines=text.trim().split(/\r?\n/),values=(lines[1]||'').split('|')
   return res.status(response.ok?200:502).json({status:lines[0],id:values[0]||'',parcel:values[1]||'',voivodeship:values[2]||'',county:values[3]||'',commune:values[4]||'',region:values[5]||'',datasource:values[6]||'',geometry:values.slice(7).join('|')||'',raw:text})
  }
  if(!SERVICES[type])return res.status(400).json({error:'Nieznany typ warstwy'})
  const requested=Number(req.query.size),mapSize=[100,250,500,1000].includes(requested)?requested:250,[mapX,mapY]=proj4('EPSG:4326','EPSG:2180',[x,y]),half=mapSize/2,layers=await layerNames(SERVICES[type],type)
  const params=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',FORMAT:'image/png',TRANSPARENT:type==='ortho'?'FALSE':'TRUE',SRS:'EPSG:2180',BBOX:`${mapX-half},${mapY-half},${mapX+half},${mapY+half}`,WIDTH:'1024',HEIGHT:'1024',LAYERS:layers.join(','),STYLES:''})
  const mapUrl=SERVICES[type]+'?'+params.toString()
  if(req.query.debug==='1')return res.status(200).json({service:SERVICES[type],layers,mapUrl,input:{epsg:4326,lat:y,lon:x},center:{epsg:2180,x:mapX,y:mapY},mapSize})
  const response=await fetch(mapUrl),buffer=Buffer.from(await response.arrayBuffer())
  res.setHeader('Content-Type',response.headers.get('content-type')||'image/png');res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');return res.status(response.ok?200:502).send(buffer)
 }catch(error){return res.status(500).json({error:error.message})}
}
