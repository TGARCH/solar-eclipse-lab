import proj4 from 'proj4'

const EPSG2180='+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs'
proj4.defs('EPSG:2180',EPSG2180)

const SERVICES={
 ortho:{url:'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/HighResolution',layers:['Raster'],format:'image/jpeg',version:'1.3.0'},
 egib:{url:'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow',layers:['dzialki','numery_dzialek','budynki'],format:'image/png',version:'1.1.1'},
 gesut:{url:'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu',layers:['przewod_wodociagowy','przewod_kanalizacyjny','przewod_gazowy','przewod_cieplowniczy','przewod_elektroenergetyczny','przewod_telekomunikacyjny','przewod_specjalny'],format:'image/png',version:'1.1.1'},
 bdot:{url:'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaBazDanychObiektowTopograficznych',layers:['bdot'],format:'image/png',version:'1.1.1'}
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
  const requested=Number(req.query.size),mapSize=[100,250,500,1000].includes(requested)?requested:250,[mapX,mapY]=proj4('EPSG:4326','EPSG:2180',[x,y]),half=mapSize/2,config=SERVICES[type],bbox=config.version==='1.3.0'?`${mapY-half},${mapX-half},${mapY+half},${mapX+half}`:`${mapX-half},${mapY-half},${mapX+half},${mapY+half}`
  const params=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:config.version,FORMAT:config.format,TRANSPARENT:type==='ortho'?'FALSE':'TRUE',BBOX:bbox,WIDTH:'1600',HEIGHT:'1600',LAYERS:config.layers.join(','),STYLES:''})
  params.set(config.version==='1.3.0'?'CRS':'SRS','EPSG:2180')
  const mapUrl=config.url+'?'+params.toString()
  if(req.query.debug==='1')return res.status(200).json({service:config.url,layers:config.layers,mapUrl,input:{epsg:4326,lat:y,lon:x},center:{epsg:2180,x:mapX,y:mapY},mapSize})
  const response=await fetch(mapUrl),buffer=Buffer.from(await response.arrayBuffer())
  res.setHeader('Content-Type',response.headers.get('content-type')||'image/png');res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');return res.status(response.ok?200:502).send(buffer)
 }catch(error){return res.status(500).json({error:error.message})}
}
