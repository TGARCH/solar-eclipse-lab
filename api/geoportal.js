const SERVICES={
 ortho:'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution',
 egib:'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow',
 utilities:'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu',
 mpzp:'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaMiejscowychPlanowZagospodarowaniaPrzestrzennego'
}
const preferred={ortho:['Raster'],egib:['dzialki','numery_dzialek','budynki','kontury','uzytki'],utilities:[],mpzp:[]}
async function layerNames(service,type){
 const response=await fetch(service+'?SERVICE=WMS&REQUEST=GetCapabilities')
 const xml=await response.text(),names=[...xml.matchAll(/<(?:\\w+:)?Name>([^<]+)<\\/(?:\\w+:)?Name>/g)].map(m=>m[1]).filter(n=>!/^WMS$/i.test(n))
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
  const dLat=.0018,dLon=.0028/Math.max(.3,Math.cos(y*Math.PI/180)),layers=await layerNames(SERVICES[type],type)
  if(req.query.debug==='1')return res.status(200).json({service:SERVICES[type],layers})
  const params=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.3.0',FORMAT:'image/png',TRANSPARENT:type==='ortho'?'FALSE':'TRUE',CRS:'EPSG:4326',BBOX:`${y-dLat},${x-dLon},${y+dLat},${x+dLon}`,WIDTH:'1024',HEIGHT:'768',LAYERS:layers.join(','),STYLES:''})
  const response=await fetch(SERVICES[type]+'?'+params),buffer=Buffer.from(await response.arrayBuffer())
  res.setHeader('Content-Type',response.headers.get('content-type')||'image/png');res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');return res.status(response.ok?200:502).send(buffer)
 }catch(error){return res.status(500).json({error:error.message})}
}
