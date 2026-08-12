import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls, PerspectiveCamera, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import IfcViewer from './IfcViewer'
import './styles.css'

const AU_KM = 149597870.7
const EARTH_RADIUS_KM = 6371
const DAY = 86400
const PLANETS = [
  { name:'Merkury', radius:2439.7, au:.387, period:87.969, color:'#9f9b91' },
  { name:'Wenus', radius:6051.8, au:.723, period:224.701, color:'#d9ad72' },
  { name:'Ziemia', radius:6371, au:1, period:365.256, color:'#3f7ee8' },
  { name:'Mars', radius:3389.5, au:1.524, period:686.98, color:'#bd5537' },
  { name:'Jowisz', radius:69911, au:5.203, period:4332.59, color:'#d0a078' },
  { name:'Saturn', radius:58232, au:9.537, period:10759.22, color:'#d7c486' },
  { name:'Uran', radius:25362, au:19.191, period:30688.5, color:'#8ed5da' },
  { name:'Neptun', radius:24622, au:30.069, period:60182, color:'#4168d8' }
]
const SUN_RADIUS = 696340
const MOON_RADIUS = 1737.4
const MOON_DISTANCE = 384400

const distanceFor = (au, scale) => scale === 'astronomical' ? 3.25 + Math.log10(au / .387 + 1) * 17.2 : 3.5 + Math.pow(au, .42) * 4.35
const radiusFor = km => .105 + Math.pow(km / EARTH_RADIUS_KM, .48) * .16

function Orbit({ radius }) {
  const points = useMemo(() => Array.from({length:161}, (_,i) => {
    const a = i / 160 * Math.PI * 2
    return [Math.cos(a) * radius, 0, Math.sin(a) * radius]
  }), [radius])
  return <Line points={points} color="#26334b" transparent opacity={.62} lineWidth={1}/>
}

const EARTH_TEXTURE_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg'

function EarthMaterial() {
  const map = useTexture(EARTH_TEXTURE_URL)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  return <meshStandardMaterial map={map} roughness={.82} metalness={0}/>
}

function EarthMoonSystem({ earthRadius, running, speed, trueScale=false }) {
  const orbit = useRef()
  const moonRadius = earthRadius * .2724
  const visualDistance = earthRadius * (trueScale ? 60.3 : 4.6)
  const inclination = THREE.MathUtils.degToRad(5.145)
  const orbitPoints = useMemo(() => Array.from({length:129},(_,i)=>{
    const a=i/128*Math.PI*2
    return [Math.cos(a)*visualDistance,0,Math.sin(a)*visualDistance]
  }),[visualDistance])
  useFrame((_,dt)=>{
    if (running && orbit.current) orbit.current.rotation.y += dt * speed * (365.256 / 27.3217) * .13
  })
  return <group rotation={[inclination,0,0]}>
    <Line points={orbitPoints} color="#52647e" transparent opacity={.5} lineWidth={1}/>
    <group ref={orbit}>
      <mesh position={[visualDistance,0,0]} castShadow receiveShadow>
        <sphereGeometry args={[moonRadius,32,32]}/>
        <meshStandardMaterial color="#aeb3ba" roughness={1}/>
      </mesh>
    </group>
  </group>
}

function Planet({ body, distance, running, speed, selected, select, earthAnchor }) {
  const orbit = useRef()
  const spin = useRef()
  const radius = radiusFor(body.radius)
  useFrame((_, dt) => {
    if (running) orbit.current.rotation.y += dt * speed * (365.256 / body.period) * .13
    spin.current.rotation.y += dt * .28
  })
  return <group ref={orbit}>
    <group ref={body.name==='Ziemia'?earthAnchor:undefined} position={[distance, 0, 0]}>
      {body.name==='Ziemia' ? <group rotation={[0,0,THREE.MathUtils.degToRad(23.44)]}>
        <mesh ref={spin} castShadow receiveShadow onClick={e => { e.stopPropagation(); select(body.name) }}>
          <sphereGeometry args={[radius,48,48]}/><EarthMaterial/>
        </mesh>
        <Line points={[[0,-radius*1.55,0],[0,radius*1.55,0]]} color="#9bc6ef" transparent opacity={.72} lineWidth={1}/>
      </group> : <mesh ref={spin} castShadow receiveShadow onClick={e => { e.stopPropagation(); select(body.name) }}>
        <sphereGeometry args={[radius,40,40]}/><meshStandardMaterial color={body.color} roughness={.78}/>
      </mesh>}
      {body.name === 'Saturn' && <mesh rotation={[Math.PI/2,0,0]} castShadow receiveShadow>
        <ringGeometry args={[radius*1.25,radius*1.9,80]}/>
        <meshStandardMaterial color="#c7b27a" side={THREE.DoubleSide} transparent opacity={.72}/>
      </mesh>}
      {body.name === 'Ziemia' && <EarthMoonSystem earthRadius={radius} running={running} speed={speed}/>} 
    </group>
  </group>
}

function CameraSwitch({ mode, earthCamera }) {
  const globalCamera = useRef()
  useFrame(({ set, camera }) => {
    if (!globalCamera.current && camera !== earthCamera.current) globalCamera.current = camera
    const target = mode === 'earth' ? earthCamera.current : globalCamera.current
    if (target && camera !== target) set({ camera: target })
  })
  return null
}

function SystemEarthRig({ active, anchor }) {
  const cameraRef = useRef()
  const [rigCamera,setRigCamera] = useState(null)
  const controls = useRef()
  const globalCamera = useRef()
  const previousTarget = useRef(new THREE.Vector3())
  const initialized = useRef(false)
  const captureCamera = useCallback(camera => {
    cameraRef.current = camera
    setRigCamera(camera)
  }, [])
  useFrame(({ set, camera }) => {
    if (!globalCamera.current && camera !== cameraRef.current) globalCamera.current = camera
    if (!active) {
      if (initialized.current && globalCamera.current) set({camera:globalCamera.current})
      initialized.current = false
      return
    }
    if (!cameraRef.current || !anchor.current || !controls.current) return
    const target = new THREE.Vector3()
    anchor.current.getWorldPosition(target)
    if (!initialized.current) {
      cameraRef.current.position.copy(target).add(new THREE.Vector3(1.35,.72,1.75))
      controls.current.target.copy(target)
      previousTarget.current.copy(target)
      initialized.current = true
      set({camera:cameraRef.current})
    } else {
      const delta = target.clone().sub(previousTarget.current)
      cameraRef.current.position.add(delta)
      controls.current.target.copy(target)
      previousTarget.current.copy(target)
    }
    controls.current.update()
  })
  return <>
    <PerspectiveCamera ref={captureCamera} near={.015} far={160} fov={44}/>
    {active && rigCamera && <OrbitControls ref={controls} makeDefault camera={rigCamera} enableDamping dampingFactor={.08} enableRotate enableZoom zoomToCursor enablePan={false} minDistance={.48} maxDistance={7} minPolarAngle={.22} maxPolarAngle={2.92} rotateSpeed={.55} zoomSpeed={.8}/>}
  </>
}

function SolarSystem({ running, speed, scale, selected, select, cameraMode }) {
  const earthAnchor = useRef()
  const maxOrbit = distanceFor(30.069, scale)
  return <>
    <ambientLight intensity={.08}/>
    <pointLight position={[0,0,0]} intensity={900} distance={maxOrbit*2.3} decay={1.25} color="#fff2cf" castShadow shadow-mapSize={[2048,2048]} shadow-bias={-.0002}/>
    <mesh castShadow={false} onClick={() => select('Słońce')}>
      <sphereGeometry args={[1.15,64,64]}/><meshBasicMaterial color="#ffb52d"/>
    </mesh>
    <pointLight position={[0,0,0]} intensity={38} distance={8} color="#ff9e1c"/>
    {PLANETS.map(body => {
      const distance = distanceFor(body.au, scale)
      return <React.Fragment key={body.name}>
        <Orbit radius={distance}/>
        <Planet body={body} distance={distance} running={running} speed={speed} selected={selected} select={select} earthAnchor={body.name === 'Ziemia' ? earthAnchor : undefined}/>
      </React.Fragment>
    })}
    <SystemEarthRig active={cameraMode==='earth'} anchor={earthAnchor}/>
    {cameraMode === 'global' && <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={maxOrbit*2.2}/>}
  </>
}

function TrueMoon({ running, speed, register, select }) {
  const orbit = useRef()
  const moonRadius = MOON_RADIUS / AU_KM * 10
  const moonDistance = MOON_DISTANCE / AU_KM * 10
  useFrame((_,dt)=>{ if(running && orbit.current) orbit.current.rotation.y += dt*speed*(365.256/27.3217)*.13 })
  return <group rotation={[THREE.MathUtils.degToRad(5.145),0,0]}>
    <Orbit radius={moonDistance}/>
    <group ref={orbit}>
      <mesh ref={node=>{if(node)register('Księżyc',node,moonRadius)}} position={[moonDistance,0,0]} onClick={e=>{e.stopPropagation();select('Księżyc')}}>
        <sphereGeometry args={[moonRadius,32,32]}/><meshStandardMaterial color="#aeb3ba" roughness={1}/>
      </mesh>
    </group>
  </group>
}

function TruePlanet({ body, running, speed, register, select }) {
  const orbit = useRef()
  const spin = useRef()
  const radius = body.radius / AU_KM * 10
  const distance = body.au * 10
  useFrame((_,dt)=>{
    if(running && orbit.current) orbit.current.rotation.y += dt*speed*(365.256/body.period)*.13
    if(spin.current) spin.current.rotation.y += dt*.28
  })
  return <>
    <Orbit radius={distance}/>
    <group ref={orbit}>
      <group ref={node=>{if(node)register(body.name,node,radius)}} position={[distance,0,0]}>
        {body.name==='Ziemia' ? <group rotation={[0,0,THREE.MathUtils.degToRad(23.44)]}>
          <mesh ref={spin} onClick={e=>{e.stopPropagation();select(body.name)}}>
            <sphereGeometry args={[radius,48,48]}/><EarthMaterial/>
          </mesh>
          <Line points={[[0,-radius*1.55,0],[0,radius*1.55,0]]} color="#9bc6ef" transparent opacity={.8}/>
        </group> : <mesh ref={spin} onClick={e=>{e.stopPropagation();select(body.name)}}>
          <sphereGeometry args={[radius,40,40]}/><meshStandardMaterial color={body.color} roughness={.78}/>
        </mesh>}
        {body.name==='Ziemia' && <TrueMoon running={running} speed={speed} register={register} select={select}/>}
        {body.name==='Saturn' && <mesh rotation={[Math.PI/2,0,0]}>
          <ringGeometry args={[radius*1.25,radius*1.9,64]}/><meshStandardMaterial color="#c7b27a" side={THREE.DoubleSide}/>
        </mesh>}
      </group>
    </group>
  </>
}

function TrueScaleCamera({ focus, targets }) {
  const cameraRef = useRef()
  const [camera,setCamera] = useState(null)
  const controls = useRef()
  const lastFocus = useRef('')
  const previousTarget = useRef(new THREE.Vector3())
  const capture = useCallback(node=>{cameraRef.current=node;setCamera(node)},[])
  const radius = focus==='Przegląd' ? 30 : (targets.current[focus]?.radius || .001)
  useFrame(({set})=>{
    if(!cameraRef.current || !controls.current) return
    const entry=targets.current[focus]
    const target=new THREE.Vector3()
    if(focus!=='Przegląd'){
      if(!entry?.node) return
      entry.node.getWorldPosition(target)
    }
    if(lastFocus.current!==focus){
      const distance=focus==='Przegląd'?390:Math.max(radius*5,radius+.00035)
      cameraRef.current.near=focus==='Przegląd'?.01:Math.max(radius/100,.0000001)
      cameraRef.current.far=1000
      cameraRef.current.updateProjectionMatrix()
      cameraRef.current.position.copy(target).add(focus==='Przegląd'?new THREE.Vector3(0,225,320):new THREE.Vector3(distance*.55,distance*.35,distance))
      controls.current.target.copy(target)
      previousTarget.current.copy(target)
      lastFocus.current=focus
      set({camera:cameraRef.current})
    }else if(focus!=='Przegląd'){
      const delta=target.clone().sub(previousTarget.current)
      cameraRef.current.position.add(delta)
      controls.current.target.copy(target)
      previousTarget.current.copy(target)
    }
    controls.current.update()
  })
  return <>
    <PerspectiveCamera ref={capture} fov={42}/>
    {camera&&<OrbitControls ref={controls} makeDefault camera={camera} enableDamping enablePan={false} minDistance={focus==='Przegląd'?3:Math.max(radius*1.2,.00015)} maxDistance={focus==='Przegląd'?700:Math.max(radius*40,.01)} zoomToCursor/>}
  </>
}

function TrueScaleSolarSystem({ running, speed, focus, setFocus }) {
  const targets=useRef({})
  const register=useCallback((name,node,radius)=>{targets.current[name]={node,radius}},[])
  const sunRadius=SUN_RADIUS/AU_KM*10
  return <>
    <ambientLight intensity={.045}/>
    <pointLight position={[0,0,0]} intensity={2500} distance={650} decay={1.1} color="#fff1cf"/>
    <mesh ref={node=>{if(node)register('Słońce',node,sunRadius)}} onClick={()=>setFocus('Słońce')}>
      <sphereGeometry args={[sunRadius,64,64]}/><meshBasicMaterial color="#ffb52d"/>
    </mesh>
    {PLANETS.map(body=><TruePlanet key={body.name} body={body} running={running} speed={speed} register={register} select={setFocus}/>)}
    <TrueScaleCamera focus={focus} targets={targets}/>
  </>
}

function ShadowVolume({ origin, direction, length, r0, r1, color, opacity }) {
  const geometry = useMemo(() => new THREE.CylinderGeometry(r1, r0, length, 64, 1, true), [length,r0,r1])
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), direction.clone().normalize()), [direction.x,direction.y,direction.z])
  const midpoint = useMemo(() => origin.clone().add(direction.clone().normalize().multiplyScalar(length/2)), [origin.x,origin.y,origin.z,direction.x,direction.y,direction.z,length])
  return <mesh geometry={geometry} position={midpoint} quaternion={quaternion} renderOrder={2}>
    <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false}/>
  </mesh>
}

const eclipseVertex = `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const eclipseFragment = `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  uniform vec3 uBaseColor;
  uniform vec3 uSun;
  uniform vec3 uOcculter;
  uniform vec3 uShadowDirection;
  uniform float uOcculterRadius;
  uniform float uSunRadius;
  uniform float uOpticalScale;
  uniform float uOpticalSourceDistance;

  void main() {
    vec3 toSun = normalize(uSun - vWorldPosition);
    float diffuse = max(dot(normalize(vWorldNormal), toSun), 0.0);
    vec3 rel = vWorldPosition - uOcculter;
    float axial = dot(rel, uShadowDirection);
    vec3 radialVector = rel - uShadowDirection * axial;
    float radial = length(radialVector);
    float opticalAxial = max(axial, 0.0) * uOpticalScale;
    float umbra = max(0.0, uOcculterRadius - opticalAxial * (uSunRadius-uOcculterRadius) / uOpticalSourceDistance);
    float penumbra = uOcculterRadius + opticalAxial * (uSunRadius+uOcculterRadius) / uOpticalSourceDistance;
    float shadow = axial > 0.0 ? 1.0-smoothstep(umbra, max(umbra+.0005,penumbra), radial) : 0.0;
    float light = (0.065 + diffuse * 0.935) * (1.0-shadow*.94);
    gl_FragColor = vec4(uBaseColor * light, 1.0);
  }
`

function EclipseSurface({ color, sun, occulter, direction, occulterRadius, opticalScale, opticalSourceDistance }) {
  const uniforms = useMemo(() => ({
    uBaseColor:{value:new THREE.Color(color)},
    uSun:{value:sun.clone()},
    uOcculter:{value:occulter.clone()},
    uShadowDirection:{value:direction.clone()},
    uOcculterRadius:{value:occulterRadius},
    uSunRadius:{value:109.1},
    uOpticalScale:{value:opticalScale},
    uOpticalSourceDistance:{value:opticalSourceDistance}
  }), [color,sun.x,sun.y,sun.z,occulter.x,occulter.y,occulter.z,direction.x,direction.y,direction.z,occulterRadius,opticalScale,opticalSourceDistance])
  return <shaderMaterial uniforms={uniforms} vertexShader={eclipseVertex} fragmentShader={eclipseFragment}/>
}

function EclipseScene({ type, phase, cameraMode, showVolume }) {
  const earthSpin = useRef()
  const attachedCamera = useRef()
  const [rigCamera,setRigCamera] = useState(null)
  const captureCamera = useCallback(camera => {
    attachedCamera.current = camera
    setRigCamera(camera)
  }, [])
  const solar = type === 'solar'
  const sun = useMemo(() => new THREE.Vector3(-44,0,0), [])
  const earth = useMemo(() => new THREE.Vector3(5,0,0), [])
  const visualSunR = 4.25, earthR = 1, moonR = .2724
  const orbitRadius = 4.15
  const inclination = THREE.MathUtils.degToRad(5.145)
  const angle = (solar ? Math.PI : 0) + (phase-.5) * Math.PI * 2
  const moon = useMemo(() => new THREE.Vector3(
    earth.x + Math.cos(angle) * orbitRadius,
    Math.sin(angle) * orbitRadius * Math.sin(inclination),
    Math.sin(angle) * orbitRadius * Math.cos(inclination)
  ), [earth.x,angle])
  const moonLocal = moon.clone().sub(earth)
  const orbitPoints = useMemo(() => Array.from({length:129},(_,i) => {
    const a=i/128*Math.PI*2
    return [Math.cos(a)*orbitRadius,Math.sin(a)*orbitRadius*Math.sin(inclination),Math.sin(a)*orbitRadius*Math.cos(inclination)]
  }), [])
  const occulter = solar ? moon : earth
  const target = solar ? earth : moon
  const occR = solar ? moonR : earthR
  const targetR = solar ? earthR : moonR
  const opticalTargetDistance = solar ? 56.0 : 60.3
  const opticalSourceDistance = solar ? 23455-56.0 : 23455
  const ray = occulter.clone().sub(sun)
  const direction = ray.normalize()
  const toTarget = target.clone().sub(occulter)
  const targetDistance = toTarget.dot(direction)
  const missDistance = toTarget.clone().sub(direction.clone().multiplyScalar(targetDistance)).length()
  const opticalScale = opticalTargetDistance / Math.max(.001,targetDistance)
  const umbraAtTarget = Math.max(0,occR-opticalTargetDistance*(109.1-occR)/opticalSourceDistance)
  const penumbraAtTarget = occR+opticalTargetDistance*(109.1+occR)/opticalSourceDistance
  const umbraVisualLength = targetDistance * Math.min(1, occR / Math.max(.0001,occR-umbraAtTarget))
  const aligned = targetDistance>0 && missDistance < penumbraAtTarget+targetR
  useFrame((_,dt) => {
    if (earthSpin.current) earthSpin.current.rotation.y += dt*.075
  })
  return <>
    <ambientLight intensity={.025}/>
    <pointLight position={sun} intensity={4600} distance={110} decay={1.15} color="#fff2d2"/>
    <mesh position={sun}><sphereGeometry args={[visualSunR,64,64]}/><meshBasicMaterial color="#ffb32c"/></mesh>
    <group position={earth}>
      <Line points={orbitPoints} color="#5c718f" transparent opacity={.45}/>
      <group ref={earthSpin} rotation={[0,0,THREE.MathUtils.degToRad(23.44)]}>
        <mesh>
          <sphereGeometry args={[earthR,96,96]}/>
          {solar
            ? <EclipseSurface color="#73aee8" sun={sun} occulter={moon} direction={direction} occulterRadius={moonR} opticalScale={opticalScale} opticalSourceDistance={opticalSourceDistance}/>
            : <meshStandardMaterial color="#2867bb" roughness={.86}/>}
        </mesh>
        <PerspectiveCamera ref={captureCamera} position={[0,1.1,4.4]} near={.05} far={120} fov={40} onUpdate={camera=>camera.lookAt(0,0,0)}/>
      </group>
      <mesh position={moonLocal}>
        <sphereGeometry args={[moonR,64,64]}/>
        {!solar
          ? <EclipseSurface color="#b8bdc5" sun={sun} occulter={earth} direction={direction} occulterRadius={earthR} opticalScale={opticalScale} opticalSourceDistance={opticalSourceDistance}/>
          : <meshStandardMaterial color="#aeb4bd" roughness={1}/>}
      </mesh>
    </group>
    {showVolume && aligned && <>
      <ShadowVolume origin={occulter} direction={direction} length={Math.max(targetDistance+targetR,umbraVisualLength)} r0={occR} r1={Math.max(.001,umbraAtTarget)} color="#02040a" opacity={.30}/>
      <ShadowVolume origin={occulter} direction={direction} length={targetDistance+targetR} r0={occR} r1={penumbraAtTarget} color="#71839d" opacity={.07}/>
    </>}
    <Line points={[sun.toArray(),earth.toArray()]} color="#ffcb66" transparent opacity={.17}/>
    <CameraSwitch mode={cameraMode} earthCamera={attachedCamera}/>
    {cameraMode === 'global' && <OrbitControls makeDefault target={[2,0,0]} enableDamping minDistance={5} maxDistance={75}/>}
    {cameraMode === 'earth' && rigCamera && <OrbitControls makeDefault camera={rigCamera} target={[0,0,0]} enableDamping dampingFactor={.08} enableRotate enableZoom zoomToCursor enablePan={false} minDistance={2.15} maxDistance={11} minPolarAngle={.28} maxPolarAngle={2.86} rotateSpeed={.5} zoomSpeed={.75}/>}
  </>
}

function ScaleLegend({ scale }) {
  const real = scale==='true'
  return <div className="scale-note">
    <span>SKALA WIDOKU</span>
    <strong>{real?'1:1 · Ziemia–Księżyc':'Schemat · cały układ'}</strong>
    <p>{real?'Promienie i średnia odległość 60,3 R⊕ są liniowe. Cały układ zachowuje liniowe promienie i odległości; użyj nawigatora, aby przejść od przeglądu do skali konkretnego ciała.':'Rozmiary i odległości są jawnie skompresowane; okresy obiegu zachowują relacje astronomiczne.'}</p>
  </div>
}

const IFC_CATEGORIES = [
  ['Ściany', 1], ['Płyty / stropy', 5], ['Dachy', 1],
  ['Drzwi', 1], ['Okna', 1], ['Otwory', 2]
]

function App() {
  const [view,setView] = useState('bim')
  const [scale,setScale] = useState('schematic')
  const [running,setRunning] = useState(true)
  const [speed,setSpeed] = useState(1)
  const [selected,setSelected] = useState('Ziemia')
  const [eclipse,setEclipse] = useState('solar')
  const [phase,setPhase] = useState(.5)
  const [cameraMode,setCameraMode] = useState('global')
  const [showVolume,setShowVolume] = useState(true)
  const [trueFocus,setTrueFocus] = useState('Przegląd')
  const [selectedIfc,setSelectedIfc] = useState(null)
  const [ifcState,setIfcState] = useState({status:'Oczekiwanie na model',error:null,meshes:0})
  const handleIfcState = useCallback(update => setIfcState(previous => ({...previous,...update})), [])
  const chosen = PLANETS.find(p=>p.name===selected)
  const isBim = view === 'bim'
  return <main className={isBim?'bim-mode':''}>
    <header>
      <div><span className="eyebrow">{isBim?'OPEN BIM · IFC4 REFERENCE VIEW':'ORBITAL MECHANICS · INTERACTIVE 3D'}</span><h1>{isBim?<>IFC <em>Model Lab</em></>:<>Solar <em>Eclipse Lab</em></>}</h1></div>
      <nav className="tabs" aria-label="Widok">
        <button className={view==='bim'?'active':''} onClick={()=>setView('bim')}>Model IFC</button>
        <button className={view==='system'?'active':''} onClick={()=>{setView('system');setCameraMode('global')}}>Układ Słoneczny</button>
        <button className={view==='eclipse'?'active':''} onClick={()=>{setView('eclipse');setCameraMode('global')}}>Zaćmienia</button>
      </nav>
    </header>
    <section className="stage">
      <Canvas shadows dpr={[1,1.75]} camera={{position:isBim?[10,8,12]:view==='system'?[18,14,22]:[17,9,18],fov:46}} gl={{antialias:true,toneMapping:THREE.ACESFilmicToneMapping}}>
        <color attach="background" args={[isBim?'#0a1118':'#03060c']}/>
        {!isBim&&<fog attach="fog" args={['#03060c',42,105]}/>}
        <Suspense fallback={null}>{isBim
          ? <IfcViewer selectedId={selectedIfc?.id} onSelect={setSelectedIfc} onState={handleIfcState}/>
          : view==='system'
            ? (scale==='true' ? <TrueScaleSolarSystem running={running} speed={speed} focus={trueFocus} setFocus={setTrueFocus}/> : <SolarSystem running={running} speed={speed} scale="schematic" selected={selected} select={setSelected} cameraMode={cameraMode}/>)
            : <EclipseScene type={eclipse} phase={phase} cameraMode={cameraMode} showVolume={showVolume}/>}
        </Suspense>
      </Canvas>
      <div className="status"><i className={!ifcState.error&&(isBim||running)?'live':''}/>{isBim?ifcState.status:view==='system'?(running?'SYMULACJA AKTYWNA':'PAUZA'):(eclipse==='solar'?'ZAĆMIENIE SŁOŃCA':'ZAĆMIENIE KSIĘŻYCA')}</div>
      {view==='system'&&scale==='true'&&<nav className="screen-navigator" aria-label="Nawigator obiektów w skali 1:1">
        <span>PRZEJDŹ DO</span>
        <div>{['Przegląd','Słońce','Merkury','Wenus','Ziemia','Księżyc','Mars','Jowisz','Saturn','Uran','Neptun'].map(name=><button key={name} className={trueFocus===name?'on':''} onClick={()=>setTrueFocus(name)}>{name}</button>)}</div>
      </nav>}
      <aside className="panel">
        {isBim ? <>
          <span className="section-kicker">ŹRÓDŁO · TEST.IFC</span><h2>Dane wygenerowane z IFC</h2>
          <div className="ifc-file"><div><b>IFC4</b><span>ReferenceView V1.1</span></div><strong>38,8 KB</strong></div>
          <div className="facts ifc-facts"><div><span>Kondygnacje</span><b>2</b></div><div><span>Zestawy właściwości</span><b>37</b></div><div><span>Bryły wyciągane</span><b>15</b></div><div><span>Siatki w scenie</span><b>{ifcState.meshes||'—'}</b></div></div>
          <div className="ifc-tree"><span className="data-title">ELEMENTY MODELU</span>{IFC_CATEGORIES.map(([name,count])=><div key={name}><span>{name}</span><b>{count}</b></div>)}</div>
          <div className="storeys"><span className="data-title">STRUKTURA PRZESTRZENNA</span><div><b>Poziom 2</b><span>+4 000 mm</span></div><div><b>Poziom 1</b><span>±0 mm</span></div></div>
          <div className={'ifc-selection '+(selectedIfc?'selected':'')}>
            <span className="data-title">WYBRANY ELEMENT</span>
            {selectedIfc?<><strong>{selectedIfc.name}</strong><span>{selectedIfc.type} · #{selectedIfc.id}</span><code>{selectedIfc.globalId}</code></>:<p>Kliknij element modelu, aby odczytać jego dane IFC.</p>}
          </div>
          {ifcState.error&&<div className="ifc-error">{ifcState.error}</div>}
          <a className="download-ifc" href="/models/test.ifc" download>Pobierz źródłowy plik IFC</a>
        </> : view==='system' ? <>
          <span className="section-kicker">MODEL DANYCH</span><h2>Proporcje, które można odczytać</h2>
          <div className="segmented"><button className={scale==='schematic'?'on':''} onClick={()=>setScale('schematic')}>Schemat</button><button className={scale==='true'?'on':''} onClick={()=>{setScale('true');setSelected('Ziemia')}}>1:1</button></div>
          <ScaleLegend scale={scale}/>
          <button className="primary" onClick={()=>setRunning(v=>!v)}>{running?'Zatrzymaj orbity':'Uruchom orbity'}</button>
          <label>Tempo symulacji <b>{speed.toFixed(1)}×</b><input type="range" min=".2" max="5" step=".1" value={speed} onChange={e=>setSpeed(+e.target.value)}/></label>
          <div className="object-card"><small>WYBRANY OBIEKT</small><strong>{selected}</strong>{chosen&&<span>R = {chosen.radius.toLocaleString('pl-PL')} km · a = {chosen.au} AU<br/>Okres: {chosen.period.toLocaleString('pl-PL')} dni</span>}{selected==='Ziemia'&&<span>Oś Ziemi: 23,44° · Księżyc: R = 0,2724 R⊕ · orbita 27,3217 dnia · nachylenie 5,145°<br/>{scale==='true'?'Odległość środka Księżyca: 60,3 R⊕ — skala liniowa 1:1.':'Odległość orbity jest skompresowana wyłącznie dla czytelności.'}</span>}</div>
        </> : <>
          <span className="section-kicker">GEOMETRIA ŚWIATŁA</span><h2>Umbra i penumbra</h2>
          <div className="segmented"><button className={eclipse==='solar'?'on':''} onClick={()=>setEclipse('solar')}>Słońca</button><button className={eclipse==='lunar'?'on':''} onClick={()=>setEclipse('lunar')}>Księżyca</button></div>
          <p>{eclipse==='solar'?'Księżyc blokuje tarczę Słońca. Umbra tworzy małą, ciemną plamę na Ziemi; penumbra wyznacza obszar zaćmienia częściowego.':'Ziemia przechodzi między Słońcem a Księżycem. Księżyc zanurza się kolejno w półcieniu i cieniu Ziemi.'}</p>
          <label>Faza orbity Księżyca <b>{Math.round(phase*100)}%</b><input type="range" min="0" max="1" step=".005" value={phase} onChange={e=>setPhase(+e.target.value)}/></label>
          <div className="facts"><div><span>Słońce / Ziemia</span><b>109,1×</b></div><div><span>Księżyc / Ziemia</span><b>0,2724×</b></div><div><span>Ziemia–Księżyc</span><b>384 400 km</b></div><div><span>Słońce–Ziemia</span><b>1 AU</b></div></div>
          <div className="callout">Skala widoku jest skompresowana, lecz cień korzysta z osobnej skali optycznej: 60,3 promienia Ziemi do Księżyca i 23 455 do Słońca. Plama oraz stożki wynikają z tego samego obliczenia.</div><button className="volume-toggle" onClick={()=>setShowVolume(v=>!v)}>Wolumetria edukacyjna · {showVolume?"WŁ.":"WYŁ."}</button>
        </>}
        {!isBim&&!(view==='system'&&scale==='true')&&<div className="camera-row"><span>KAMERA</span><button className={cameraMode==='global'?'on':''} onClick={()=>setCameraMode('global')}>Globalna</button><button className={cameraMode==='earth'?'on':''} onClick={()=>setCameraMode('earth')}>Ziemia · rig</button></div>}
      </aside>
      <div className="legend">{isBim?<><span>Kliknij · dane elementu</span><span>Przeciągnij · obrót</span><span>Scroll · zoom</span></>:<><span><i className="umbra"/>Umbra</span><span><i className="penumbra"/>Penumbra</span><span>Przeciągnij · obrót</span><span>Scroll · zoom</span></>}</div>
    </section>
    <footer><span>{isBim?'WEB-IFC / THREE.JS · INTERAKTYWNY MODEL BIM':'THREE.JS / R3F · PHYSICALLY BASED SHADOWS'}</span><span>{isBim?'Źródło: Autodesk Revit LT 2020 · jednostki: mm':'Dane: średnie promienie i okresy orbitalne · epoka poglądowa'}</span></footer>
  </main>
}
createRoot(document.getElementById('root')).render(<App/>)
