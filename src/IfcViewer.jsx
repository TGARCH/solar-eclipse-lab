import React, { useEffect, useMemo, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { IfcAPI } from 'web-ifc'

const valueOf = value => value && typeof value === 'object' && 'value' in value ? value.value : value

export default function IfcViewer({ selectedId, onSelect, onState }) {
  const { camera } = useThree()
  const [model, setModel] = useState(null)

  useEffect(() => {
    let disposed = false
    let api
    let modelID
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
        const root = new THREE.Group()
        const elementInfo = new Map()
        api.StreamAllMeshes(modelID, flatMesh => {
          let line
          try { line = api.GetLine(modelID, flatMesh.expressID, false) } catch {}
          let ifcType = 'IFCPRODUCT'
          try { ifcType = api.GetNameFromTypeCode(api.GetLineType(modelID, flatMesh.expressID)) } catch {}
          elementInfo.set(flatMesh.expressID, {
            id: flatMesh.expressID,
            type: ifcType,
            name: valueOf(line?.Name) || valueOf(line?.ObjectType) || 'Element bez nazwy',
            globalId: valueOf(line?.GlobalId) || '—'
          })
          const hiddenHelperTypes = new Set(['IFCSPACE', 'IFCOPENINGELEMENT'])
          if (hiddenHelperTypes.has(ifcType.toUpperCase())) return
          for (let i = 0; i < flatMesh.geometries.size(); i++) {
            const placed = flatMesh.geometries.get(i)
            const source = api.GetGeometry(modelID, placed.geometryExpressID)
            const vertices = api.GetVertexArray(source.GetVertexData(), source.GetVertexDataSize())
            const indices = api.GetIndexArray(source.GetIndexData(), source.GetIndexDataSize())
            const positions = new Float32Array(vertices.length / 2)
            const normals = new Float32Array(vertices.length / 2)
            for (let v = 0, p = 0; v < vertices.length; v += 6, p += 3) {
              positions[p] = vertices[v]; positions[p + 1] = vertices[v + 1]; positions[p + 2] = vertices[v + 2]
              normals[p] = vertices[v + 3]; normals[p + 1] = vertices[v + 4]; normals[p + 2] = vertices[v + 5]
            }
            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
            geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1))
            geometry.applyMatrix4(new THREE.Matrix4().fromArray(placed.flatTransformation))
            geometry.computeBoundingSphere()
            const c = placed.color
            const material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(c.x, c.y, c.z),
              transparent: c.w < .999,
              opacity: c.w,
              roughness: .72,
              metalness: .03,
              side: THREE.DoubleSide
            })
            material.userData.baseColor = material.color.clone()
            const mesh = new THREE.Mesh(geometry, material)
            mesh.userData.info = elementInfo.get(flatMesh.expressID)
            mesh.castShadow = true
            mesh.receiveShadow = true
            root.add(mesh)
            source.delete()
          }
        })
        const box = new THREE.Box3().setFromObject(root)
        const center = box.getCenter(new THREE.Vector3())
        const sourceSize = box.getSize(new THREE.Vector3())
        const normalization = 7.2 / Math.max(sourceSize.x, sourceSize.y, sourceSize.z)
        root.scale.setScalar(normalization)
        root.position.set(-center.x * normalization, -box.min.y * normalization, -center.z * normalization)
        const size = sourceSize.multiplyScalar(normalization)
        const targetY = Math.max(1.2, size.y * .38)
        camera.up.set(0, 1, 0)
        camera.position.set(11.5, 8.5, 14.5)
        camera.near = .02
        camera.far = 250
        camera.lookAt(0, targetY, 0)
        camera.updateProjectionMatrix()
        if (!disposed) {
          setModel(root)
          onState({ status: 'Model gotowy', error: null, meshes: root.children.length, size })
        } else {
          root.traverse(o => { o.geometry?.dispose(); o.material?.dispose() })
        }
      } catch (error) {
        onState({ status: 'Błąd wczytywania', error: error.message })
      }
    }
    load()
    return () => {
      disposed = true
      if (modelID !== undefined && api) { try { api.CloseModel(modelID) } catch {} }
      if (api) { try { api.Dispose() } catch {} }
    }
  }, [camera, onState])

  useEffect(() => {
    if (!model) return
    model.traverse(object => {
      if (!object.isMesh) return
      const selected = object.userData.info?.id === selectedId
      object.material.color.copy(object.material.userData.baseColor)
      object.material.emissive.set(selected ? '#3cc7a2' : '#000000')
      object.material.emissiveIntensity = selected ? .28 : 0
    })
  }, [model, selectedId])

  const target = useMemo(() => new THREE.Vector3(0, 1.6, 0), [])
  return <>
    <hemisphereLight intensity={1.05} color="#dcecff" groundColor="#15202a"/>
    <directionalLight position={[12, 18, 10]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-.00015}/>
    <gridHelper args={[80,80,'#5c7687','#273746']} position={[0,-.012,0]}/>
    {model && <primitive object={model} onPointerDown={event => {
      event.stopPropagation()
      const info = event.object.userData.info
      if (info) onSelect(info)
    }}/>}
    <OrbitControls makeDefault target={target} enableDamping dampingFactor={.08} minDistance={1.2} maxDistance={80} zoomToCursor/>
  </>
}
