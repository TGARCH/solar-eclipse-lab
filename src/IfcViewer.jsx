import React, { useEffect, useMemo, useState } from 'react'
import { Line, OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { IfcAPI } from 'web-ifc'
import SunCalc from 'suncalc'

const valueOf = value => value && typeof value === 'object' && 'value' in value ? value.value : value

function SectionCaps({model, plane, sectionPlane}) {
  const caps=useMemo(()=>{
    if(!model||!plane)return null
    model.updateMatrixWorld(true)
    const root=new THREE.Group(),epsilon=1e-4
    const key=p=>`${Math.round(p.x/epsilon)},${Math.round(p.y/epsilon)},${Math.round(p.z/epsilon)}`
    model.children.forEach(source=>{
      if(!source.isMesh)return
      const position=source.geometry.getAttribute('position'),index=source.geometry.index
      const segments=[]
      const vertex=i=>new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(source.matrixWorld)
      const edge=(a,b,points)=>{
        const da=plane.distanceToPoint(a),db=plane.distanceToPoint(b)
        if(Math.abs(da)<epsilon)points.push(a.clone())
        if(da*db<0)points.push(a.clone().lerp(b,da/(da-db)))
      }
      const count=index?index.count:position.count
      for(let i=0;i<count;i+=3){
        const a=vertex(index?index.getX(i):i),b=vertex(index?index.getX(i+1):i+1),d=vertex(index?index.getX(i+2):i+2),points=[]
        edge(a,b,points);edge(b,d,points);edge(d,a,points)
        const unique=[...new Map(points.map(p=>[key(p),p])).values()]
        if(unique.length===2)segments.push(unique)
      }
      const unused=segments.slice(),loops=[]
      while(unused.length){
        const first=unused.pop(),loop=[first[0],first[1]]
        let guard=0
        while(key(loop[loop.length-1])!==key(loop[0])&&unused.length&&guard++<10000){
          const last=key(loop[loop.length-1])
          const nextIndex=unused.findIndex(s=>key(s[0])===last||key(s[1])===last)
          if(nextIndex<0)break
          const next=unused.splice(nextIndex,1)[0]
          loop.push(key(next[0])===last?next[1]:next[0])
        }
        if(loop.length>3&&key(loop[loop.length-1])===key(loop[0]))loops.push(loop.slice(0,-1))
      }
      loops.forEach(loop=>{
        const points2=loop.map(p=>sectionPlane.mode==='horizontal'?new THREE.Vector2(p.x,p.z):sectionPlane.mode==='vertical-x'?new THREE.Vector2(p.z,p.y):new THREE.Vector2(p.x,p.y))
        const triangles=THREE.ShapeUtils.triangulateShape(points2,[])
        if(!triangles.length)return
        const positions=[]
        triangles.forEach(t=>t.forEach(i=>positions.push(loop[i].x,loop[i].y,loop[i].z)))
        const geometry=new THREE.BufferGeometry()
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals()
        const material=new THREE.MeshBasicMaterial({color:'#f04444',side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})
        const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=5;root.add(mesh)
      })
    })
    return root
  },[model,plane,sectionPlane.mode])
  useEffect(()=>()=>caps?.traverse(o=>{o.geometry?.dispose();o.material?.dispose()}),[caps])
  return caps?<primitive object={caps}/>:null
}

function ParcelShape({wkt,gps}){
 const points=useMemo(()=>{const match=wkt?.match(/POLYGON\(\((.+)\)\)/);if(!match)return [];const lat0=Number(gps.lat),lon0=Number(gps.lon),cos=Math.cos(lat0*Math.PI/180);return match[1].split(',').map(pair=>{const [lon,lat]=pair.trim().split(/\s+/).map(Number);return [(lon-lon0)*111320*cos,.018,-(lat-lat0)*110540]})},[wkt,gps.lat,gps.lon])
 if(points.length<4)return null
 const shape=new THREE.Shape(points.slice(0,-1).map(p=>new THREE.Vector2(p[0],p[2])))
 return <Line points={points} color="#e33f4f" lineWidth={3}/>
}

function GeoportalLayer({type,gps,height,mapSize,opacity=1,reloadKey=0}){
 const [texture,setTexture]=useState(null)
 useEffect(()=>{let active=true,current;const url=`/api/geoportal?type=${type}&lat=${encodeURIComponent(gps.lat)}&lon=${encodeURIComponent(gps.lon)}&size=${mapSize}&v=${reloadKey}`;new THREE.TextureLoader().load(url,t=>{if(!active){t.dispose();return}t.colorSpace=THREE.SRGBColorSpace;current=t;setTexture(t)},undefined,()=>active&&setTexture(null));return()=>{active=false;current?.dispose()}},[type,gps.lat,gps.lon,mapSize,reloadKey])
 return texture?<mesh position={[0,height,0]} rotation={[-Math.PI/2,0,0]} renderOrder={type==='ortho'?0:1} receiveShadow><planeGeometry args={[mapSize,mapSize]}/>{type==='ortho'?<meshStandardMaterial map={texture} color="#ffffff" roughness={1} metalness={0}/>:<meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-height*100}/>}</mesh>:null
}

export default function IfcViewer({ selectedId, onSelect, onState, sectionPlane, viewMode='model', siteRotation=0, gps={lat:'52.25',lon:'21'}, geoLayers={}, geoReload=0, mapSize=250, parcel=null, solar={date:'03-21',hour:12,all:false} }) {
  const { camera } = useThree()
  const [model, setModel] = useState(null)
  const clippingPlane = useMemo(() => {
    if (!sectionPlane || sectionPlane.mode === 'off') return null
    const p = sectionPlane.position
    if (sectionPlane.mode === 'horizontal') return new THREE.Plane(new THREE.Vector3(0,-1,0), p)
    if (sectionPlane.mode === 'vertical-x') return new THREE.Plane(new THREE.Vector3(-1,0,0), p)
    return new THREE.Plane(new THREE.Vector3(0,0,-1), p)
  }, [sectionPlane])

  useEffect(() => {
    let disposed = false, api, modelID
    const load = async () => {
      try {
        onState({ status: 'Inicjalizacja silnika IFC', error: null })
        api = new IfcAPI()
        api.SetWasmPath('https://cdn.jsdelivr.net/npm/web-ifc@0.0.77/', true)
        await api.Init()
        const response = await fetch('/models/test3.ifc')
        if (!response.ok) throw new Error('Nie udało się pobrać pliku IFC')
        const data = new Uint8Array(await response.arrayBuffer())
        const header=new TextDecoder().decode(data)
        const si=header.match(/IFCSIUNIT\([^;]*?\.LENGTHUNIT\.\s*,\s*(?:\.(MILLI|CENTI|DECI|KILO)\.)?\s*,\s*\.METRE\./i)
        const metersPerIfcUnit=si?({MILLI:.001,CENTI:.01,DECI:.1,KILO:1000}[si[1]?.toUpperCase()]||1):1
        onState({ status: 'Generowanie geometrii', error: null })
        modelID = api.OpenModel(data, { COORDINATE_TO_ORIGIN: true })
        const root = new THREE.Group(), elementInfo = new Map()
        api.StreamAllMeshes(modelID, flatMesh => {
          let line
          try { line = api.GetLine(modelID, flatMesh.expressID, false) } catch {}
          let ifcType = 'IFCPRODUCT'
          try { ifcType = api.GetNameFromTypeCode(api.GetLineType(modelID, flatMesh.expressID)) } catch {}
          elementInfo.set(flatMesh.expressID, { id:flatMesh.expressID, type:ifcType, name:valueOf(line?.Name)||valueOf(line?.ObjectType)||'Element bez nazwy', globalId:valueOf(line?.GlobalId)||'—' })
          if (new Set(['IFCSPACE','IFCOPENINGELEMENT']).has(ifcType.toUpperCase())) return
          for (let i=0;i<flatMesh.geometries.size();i++) {
            const placed=flatMesh.geometries.get(i), source=api.GetGeometry(modelID,placed.geometryExpressID)
            const vertices=api.GetVertexArray(source.GetVertexData(),source.GetVertexDataSize()), indices=api.GetIndexArray(source.GetIndexData(),source.GetIndexDataSize())
            const positions=new Float32Array(vertices.length/2), normals=new Float32Array(vertices.length/2)
            for(let v=0,p=0;v<vertices.length;v+=6,p+=3){positions[p]=vertices[v];positions[p+1]=vertices[v+1];positions[p+2]=vertices[v+2];normals[p]=vertices[v+3];normals[p+1]=vertices[v+4];normals[p+2]=vertices[v+5]}
            const geometry=new THREE.BufferGeometry()
            geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices),1))
            geometry.applyMatrix4(new THREE.Matrix4().fromArray(placed.flatTransformation));geometry.computeBoundingSphere()
            const c=placed.color, material=new THREE.MeshStandardMaterial({color:new THREE.Color(c.x,c.y,c.z),transparent:c.w<.999,opacity:c.w,roughness:.72,metalness:.03,side:THREE.DoubleSide})
            material.userData.baseColor=material.color.clone()
            const mesh=new THREE.Mesh(geometry,material);mesh.userData.info=elementInfo.get(flatMesh.expressID);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);source.delete()
          }
        })
        const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3()),sourceSize=box.getSize(new THREE.Vector3())
        root.scale.setScalar(metersPerIfcUnit);root.position.set(-center.x*metersPerIfcUnit,-box.min.y*metersPerIfcUnit,-center.z*metersPerIfcUnit)
        const size=sourceSize.multiplyScalar(metersPerIfcUnit),targetY=Math.max(.8,size.y*.38),span=Math.max(size.x,size.y,size.z)
        root.userData.targetY=targetY;root.userData.metersPerIfcUnit=metersPerIfcUnit
        const distance=Math.max(8,span*2.15)
        camera.up.set(0,1,0);camera.position.set(distance*.78,distance*.58,distance);camera.near=.02;camera.far=500;camera.lookAt(0,targetY,0);camera.updateProjectionMatrix()
        if(!disposed){setModel(root);onState({status:'Model gotowy',error:null,meshes:root.children.length,size,metersPerIfcUnit,unit:metersPerIfcUnit===1?'m':metersPerIfcUnit===.01?'cm':metersPerIfcUnit===.001?'mm':`${metersPerIfcUnit} m`})}else root.traverse(o=>{o.geometry?.dispose();o.material?.dispose()})
      } catch(error){onState({status:'Błąd wczytywania',error:error.message})}
    }
    load()
    return()=>{disposed=true;if(modelID!==undefined&&api){try{api.CloseModel(modelID)}catch{}}if(api){try{api.Dispose()}catch{}}}
  },[camera,onState])

  useEffect(()=>{
    if(!model)return
    model.traverse(object=>{
      if(!object.isMesh)return
      const selected=object.userData.info?.id===selectedId
      object.material.color.copy(object.material.userData.baseColor)
      object.material.emissive.set(selected?'#3cc7a2':'#000000');object.material.emissiveIntensity=selected?.28:0
      object.material.clippingPlanes=clippingPlane?[clippingPlane]:[]
      object.material.clipShadows=Boolean(clippingPlane);object.material.needsUpdate=true
    })
  },[model,selectedId,clippingPlane])

  useEffect(()=>{if(viewMode==='site'){const d=Math.max(70,mapSize*.72);camera.position.set(d*.72,d,d);camera.near=.05;camera.far=Math.max(2000,mapSize*8);camera.lookAt(0,0,0)}else if(model){const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),distance=Math.max(8,Math.max(size.x,size.y,size.z)*2.15),targetY=model.userData.targetY||1;camera.position.set(distance*.78,distance*.58,distance);camera.lookAt(0,targetY,0)}camera.updateProjectionMatrix()},[viewMode,camera,model,mapSize])
  const sunData=useMemo(()=>{
    const lat=Number(gps.lat)||52.25,lon=Number(gps.lon)||21
    const hours=solar.all?Array.from({length:11},(_,i)=>i+7):[solar.hour]
    const offset=solar.date==='03-21'?'+01:00':'+02:00'
    return hours.map(hour=>{const date=new Date(`2026-${solar.date}T${String(hour).padStart(2,'0')}:00:00${offset}`),p=SunCalc.getPosition(date,lat,lon),r=32*Math.cos(p.altitude);return {hour,altitude:p.altitude,azimuth:p.azimuth,position:[Math.sin(p.azimuth)*r,Math.max(1,32*Math.sin(p.altitude)),Math.cos(p.azimuth)*r]}}).filter(s=>s.altitude>0)
  },[gps.lat,gps.lon,solar])
  const shadowExtent=Math.max(20,mapSize*.52),ruler=mapSize>=500?100:mapSize>=250?50:10
  const target=useMemo(()=>new THREE.Vector3(0,viewMode==='site'?0:(model?.userData.targetY||1),0),[viewMode,model])
  const planeVisual=sectionPlane?.mode!=='off'&&(()=>{
    const horizontal=sectionPlane.mode==='horizontal', xCut=sectionPlane.mode==='vertical-x'
    const position=horizontal?[0,sectionPlane.position,0]:xCut?[sectionPlane.position,3.6,0]:[0,3.6,sectionPlane.position]
    const rotation=horizontal?[-Math.PI/2,0,0]:xCut?[0,Math.PI/2,0]:[0,0,0]
    return <mesh position={position} rotation={rotation} renderOrder={4}><planeGeometry args={[11,8]}/><meshBasicMaterial color="#88a9b5" transparent opacity={.025} side={THREE.DoubleSide} depthWrite={false} depthTest={false}/></mesh>
  })()
  return <>
    <hemisphereLight intensity={viewMode==='site'?.32:.82} color="#dcecff" groundColor="#15202a"/>
    {viewMode!=='site'&&<directionalLight position={[12,18,10]} intensity={2.4} castShadow shadow-mapSize={[2048,2048]} shadow-bias={-.00015}/>}
    {viewMode==='site'&&sunData.map(s=><directionalLight key={s.hour} position={s.position} intensity={solar.all?.12:3.1} castShadow shadow-mapSize={solar.all?[768,768]:[2048,2048]} shadow-camera-left={-shadowExtent} shadow-camera-right={shadowExtent} shadow-camera-top={shadowExtent} shadow-camera-bottom={-shadowExtent} shadow-bias={-.0002}/>)}
    {viewMode!=='site'&&<gridHelper args={[80,80,'#bcc9ce','#e1e7e9']} position={[0,-.012,0]}/>}
    {viewMode==='site'&&<group rotation={[0,THREE.MathUtils.degToRad(siteRotation),0]}>
      {geoLayers.ortho&&<GeoportalLayer type="ortho" gps={gps} height={-.006} mapSize={mapSize} reloadKey={geoReload}/>} 
      {geoLayers.egib&&<GeoportalLayer type="egib" gps={gps} height={.006} mapSize={mapSize} opacity={.9} reloadKey={geoReload}/>}
      {geoLayers.gesut&&<GeoportalLayer type="gesut" gps={gps} height={.012} mapSize={mapSize} opacity={.9} reloadKey={geoReload}/>}
      {geoLayers.bdot&&<GeoportalLayer type="bdot" gps={gps} height={.003} mapSize={mapSize} opacity={.72} reloadKey={geoReload}/>}
      <mesh position={[0,-.16,0]} rotation={[-Math.PI/2,0,0]}><boxGeometry args={[mapSize,mapSize,.02]}/><meshStandardMaterial color="#ffffff" roughness={.96}/></mesh>
      <group position={[-mapSize*.46,.025,mapSize*.46]}><Line points={[[0,0,0],[ruler,0,0]]} color="#25343a" lineWidth={3}/>{[0,ruler/2,ruler].map(x=><Line key={x} points={[[x,0,-ruler*.025],[x,0,ruler*.025]]} color="#25343a" lineWidth={2}/>)}</group>
    </group>}
    {model&&<primitive object={model} onPointerDown={event=>{event.stopPropagation();const info=event.object.userData.info;if(info)onSelect(info)}}/>}
    {planeVisual}
    {model&&clippingPlane&&<SectionCaps model={model} plane={clippingPlane} sectionPlane={sectionPlane}/>}
    <OrbitControls makeDefault target={target} enableDamping dampingFactor={.08} minDistance={1.2} maxDistance={viewMode==='site'?mapSize*2:80} zoomToCursor/>
  </>
}
