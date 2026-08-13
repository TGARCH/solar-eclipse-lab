import React, { useEffect, useMemo, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { IfcAPI } from 'web-ifc'

const valueOf = value => value && typeof value === 'object' && 'value' in value ? value.value : value

function SectionCaps({model, plane, sectionPlane}) {
  const stencil = useMemo(() => {
    if (!model || !plane) return null
    const group = new THREE.Group()
    group.position.copy(model.position); group.rotation.copy(model.rotation); group.scale.copy(model.scale)
    model.children.forEach(source => {
      if (!source.isMesh) return
      ;[[THREE.BackSide,THREE.IncrementWrapStencil],[THREE.FrontSide,THREE.DecrementWrapStencil]].forEach(([side,operation]) => {
        const material = new THREE.MeshBasicMaterial({
          side, clippingPlanes:[plane], depthWrite:false, depthTest:false, colorWrite:false,
          stencilWrite:true, stencilFunc:THREE.AlwaysStencil,
          stencilFail:operation, stencilZFail:operation, stencilZPass:operation
        })
        const mesh = new THREE.Mesh(source.geometry,material)
        mesh.renderOrder=2; group.add(mesh)
      })
    })
    return group
  },[model,plane])
  useEffect(()=>()=>stencil?.traverse(o=>o.material?.dispose()),[stencil])
  if(!stencil)return null
  const horizontal=sectionPlane.mode==='horizontal', xCut=sectionPlane.mode==='vertical-x'
  const position=horizontal?[0,sectionPlane.position-.002,0]:xCut?[sectionPlane.position-.002,3.6,0]:[0,3.6,sectionPlane.position-.002]
  const rotation=horizontal?[-Math.PI/2,0,0]:xCut?[0,Math.PI/2,0]:[0,0,0]
  return <><primitive object={stencil}/><mesh position={position} rotation={rotation} renderOrder={3}>
    <planeGeometry args={[12,9]}/><meshBasicMaterial color="#e54848" side={THREE.DoubleSide} depthWrite={false}
      stencilWrite stencilRef={0} stencilFunc={THREE.NotEqualStencil}
      stencilFail={THREE.ReplaceStencil} stencilZFail={THREE.ReplaceStencil} stencilZPass={THREE.ReplaceStencil}/>
  </mesh></>
}

export default function IfcViewer({ selectedId, onSelect, onState, sectionPlane }) {
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
        const box=new THREE.Box3().setFromObject(root), center=box.getCenter(new THREE.Vector3()), sourceSize=box.getSize(new THREE.Vector3()), normalization=7.2/Math.max(sourceSize.x,sourceSize.y,sourceSize.z)
        root.scale.setScalar(normalization);root.position.set(-center.x*normalization,-box.min.y*normalization,-center.z*normalization)
        const size=sourceSize.multiplyScalar(normalization), targetY=Math.max(1.2,size.y*.38)
        camera.up.set(0,1,0);camera.position.set(11.5,8.5,14.5);camera.near=.02;camera.far=250;camera.lookAt(0,targetY,0);camera.updateProjectionMatrix()
        if(!disposed){setModel(root);onState({status:'Model gotowy',error:null,meshes:root.children.length,size})}else root.traverse(o=>{o.geometry?.dispose();o.material?.dispose()})
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

  const target=useMemo(()=>new THREE.Vector3(0,1.6,0),[])
  const planeVisual=sectionPlane?.mode!=='off'&&(()=>{
    const horizontal=sectionPlane.mode==='horizontal', xCut=sectionPlane.mode==='vertical-x'
    const position=horizontal?[0,sectionPlane.position,0]:xCut?[sectionPlane.position,3.6,0]:[0,3.6,sectionPlane.position]
    const rotation=horizontal?[-Math.PI/2,0,0]:xCut?[0,Math.PI/2,0]:[0,0,0]
    return <mesh position={position} rotation={rotation} renderOrder={4}><planeGeometry args={[11,8]}/><meshBasicMaterial color="#55d8b5" transparent opacity={.055} wireframe side={THREE.DoubleSide} depthWrite={false}/></mesh>
  })()
  return <>
    <hemisphereLight intensity={1.05} color="#dcecff" groundColor="#15202a"/>
    <directionalLight position={[12,18,10]} intensity={2.4} castShadow shadow-mapSize={[2048,2048]} shadow-bias={-.00015}/>
    <gridHelper args={[80,80,'#5c7687','#273746']} position={[0,-.012,0]}/>
    {model&&<primitive object={model} onPointerDown={event=>{event.stopPropagation();const info=event.object.userData.info;if(info)onSelect(info)}}/>}
    {planeVisual}
    {model&&clippingPlane&&<SectionCaps model={model} plane={clippingPlane} sectionPlane={sectionPlane}/>}
    <OrbitControls makeDefault target={target} enableDamping dampingFactor={.08} minDistance={1.2} maxDistance={80} zoomToCursor/>
  </>
}
