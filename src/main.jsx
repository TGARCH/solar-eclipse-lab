import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line, OrbitControls, PerspectiveCamera, Stars } from '@react-three/drei'
import * as THREE from 'three'
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
      <mesh ref={spin} castShadow receiveShadow onClick={e => { e.stopPropagation(); select(body.name) }}>
        <sphereGeometry args={[radius, 40, 40]}/>
        <meshStandardMaterial color={body.color} roughness={.78}/>
      </mesh>
      {body.name === 'Saturn' && <mesh rotation={[Math.PI/2,0,0]} castShadow receiveShadow>
        <ringGeometry args={[radius*1.25,radius*1.9,80]}/>
        <meshStandardMaterial color="#c7b27a" side={THREE.DoubleSide} transparent opacity={.72}/>
      </mesh>}
      {body.name === 'Ziemia' && <group rotation={[0,0,THREE.MathUtils.degToRad(23.44)]}>
        <mesh position={[radius + .16,0,0]} castShadow receiveShadow>
          <sphereGeometry args={[Math.max(.055,radius*.2724),24,24]}/>
          <meshStandardMaterial color="#b8bdc5" roughness={1}/>
        </mesh>
      </group>}
      {selected === body.name && <Html center position={[0,radius+.38,0]}><div className="tag">{body.name}</div></Html>}
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
  const camera = useRef()
  const controls = useRef()
  const previousTarget = useRef(new THREE.Vector3())
  const initialized = useRef(false)
  useFrame(({ set }) => {
    if (!active || !camera.current || !anchor.current || !controls.current) {
      initialized.current = false
      return
    }
    const target = new THREE.Vector3()
    anchor.current.getWorldPosition(target)
    if (!initialized.current) {
      camera.current.position.copy(target).add(new THREE.Vector3(1.35,.72,1.75))
      controls.current.target.copy(target)
      previousTarget.current.copy(target)
      initialized.current = true
      set({camera:camera.current})
    } else {
      const delta = target.clone().sub(previousTarget.current)
      camera.current.position.add(delta)
      controls.current.target.copy(target)
      previousTarget.current.copy(target)
    }
    controls.current.update()
  })
  return <>
    <PerspectiveCamera ref={camera} near={.015} far={160} fov={44}/>
    {active && <OrbitControls ref={controls} makeDefault camera={camera.current} enableDamping dampingFactor={.08} enableRotate enableZoom zoomToCursor enablePan={false} minDistance={.48} maxDistance={7} minPolarAngle={.22} maxPolarAngle={2.92} rotateSpeed={.55} zoomSpeed={.8}/>}
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
  return <div className="scale-note">
    <span>SKALA WIDOKU</span>
    <strong>{scale === 'astronomical' ? 'Względna / astronomiczna' : 'Czytelna / skompresowana'}</strong>
    <p>Promienie i okresy zachowują relacje danych NASA. Odległości są {scale === 'astronomical' ? 'mapowane logarytmicznie względem AU' : 'skompresowane funkcją potęgową'}, aby 30,07 AU mieściło się na ekranie.</p>
  </div>
}

function App() {
  const [view,setView] = useState('system')
  const [scale,setScale] = useState('compressed')
  const [running,setRunning] = useState(true)
  const [speed,setSpeed] = useState(1)
  const [selected,setSelected] = useState('Ziemia')
  const [eclipse,setEclipse] = useState('solar')
  const [phase,setPhase] = useState(.5)
  const [cameraMode,setCameraMode] = useState('global')
  const [showVolume,setShowVolume] = useState(true)
  const chosen = PLANETS.find(p=>p.name===selected)
  return <main>
    <header>
      <div><span className="eyebrow">ORBITAL MECHANICS · INTERACTIVE 3D</span><h1>Solar <em>Eclipse Lab</em></h1></div>
      <nav className="tabs" aria-label="Widok">
        <button className={view==='system'?'active':''} onClick={()=>{setView('system');setCameraMode('global')}}>Układ Słoneczny</button>
        <button className={view==='eclipse'?'active':''} onClick={()=>{setView('eclipse');setCameraMode('global')}}>Laboratorium zaćmień</button>
      </nav>
    </header>
    <section className="stage">
      <Canvas shadows dpr={[1,1.75]} camera={{position:view==='system'?[18,14,22]:[17,9,18],fov:46}} gl={{antialias:true,toneMapping:THREE.ACESFilmicToneMapping}}>
        <color attach="background" args={['#03060c']}/><fog attach="fog" args={['#03060c',42,105]}/>
        <Stars radius={95} depth={45} count={2600} factor={3} saturation={0}/>
        <Suspense fallback={null}>{view==='system'
          ? <SolarSystem running={running} speed={speed} scale={scale} selected={selected} select={setSelected} cameraMode={cameraMode}/>
          : <EclipseScene type={eclipse} phase={phase} cameraMode={cameraMode} showVolume={showVolume}/>}
        </Suspense>
      </Canvas>
      <div className="status"><i className={running?'live':''}/>{view==='system'?(running?'SYMULACJA AKTYWNA':'PAUZA'):(eclipse==='solar'?'ZAĆMIENIE SŁOŃCA':'ZAĆMIENIE KSIĘŻYCA')}</div>
      <aside className="panel">
        {view==='system' ? <>
          <span className="section-kicker">MODEL DANYCH</span><h2>Proporcje, które można odczytać</h2>
          <div className="segmented"><button className={scale==='compressed'?'on':''} onClick={()=>setScale('compressed')}>Czytelna</button><button className={scale==='astronomical'?'on':''} onClick={()=>setScale('astronomical')}>Astronomiczna</button></div>
          <ScaleLegend scale={scale}/>
          <button className="primary" onClick={()=>setRunning(v=>!v)}>{running?'Zatrzymaj orbity':'Uruchom orbity'}</button>
          <label>Tempo symulacji <b>{speed.toFixed(1)}×</b><input type="range" min=".2" max="5" step=".1" value={speed} onChange={e=>setSpeed(+e.target.value)}/></label>
          <div className="object-card"><small>WYBRANY OBIEKT</small><strong>{selected}</strong>{chosen&&<span>R = {chosen.radius.toLocaleString('pl-PL')} km · a = {chosen.au} AU<br/>Okres: {chosen.period.toLocaleString('pl-PL')} dni</span>}</div>
        </> : <>
          <span className="section-kicker">GEOMETRIA ŚWIATŁA</span><h2>Umbra i penumbra</h2>
          <div className="segmented"><button className={eclipse==='solar'?'on':''} onClick={()=>setEclipse('solar')}>Słońca</button><button className={eclipse==='lunar'?'on':''} onClick={()=>setEclipse('lunar')}>Księżyca</button></div>
          <p>{eclipse==='solar'?'Księżyc blokuje tarczę Słońca. Umbra tworzy małą, ciemną plamę na Ziemi; penumbra wyznacza obszar zaćmienia częściowego.':'Ziemia przechodzi między Słońcem a Księżycem. Księżyc zanurza się kolejno w półcieniu i cieniu Ziemi.'}</p>
          <label>Faza orbity Księżyca <b>{Math.round(phase*100)}%</b><input type="range" min="0" max="1" step=".005" value={phase} onChange={e=>setPhase(+e.target.value)}/></label>
          <div className="facts"><div><span>Słońce / Ziemia</span><b>109,1×</b></div><div><span>Księżyc / Ziemia</span><b>0,2724×</b></div><div><span>Ziemia–Księżyc</span><b>384 400 km</b></div><div><span>Słońce–Ziemia</span><b>1 AU</b></div></div>
          <div className="callout">Skala widoku jest skompresowana, lecz cień korzysta z osobnej skali optycznej: 60,3 promienia Ziemi do Księżyca i 23 455 do Słońca. Plama oraz stożki wynikają z tego samego obliczenia.</div><button className="volume-toggle" onClick={()=>setShowVolume(v=>!v)}>Wolumetria edukacyjna · {showVolume?"WŁ.":"WYŁ."}</button>
        </>}
        <div className="camera-row"><span>KAMERA</span><button className={cameraMode==='global'?'on':''} onClick={()=>setCameraMode('global')}>Globalna</button><button className={cameraMode==='earth'?'on':''} onClick={()=>setCameraMode('earth')}>Ziemia · rig</button></div>{cameraMode==='earth' && <div className="camera-help"><b>Nawigacja względem Ziemi</b><span>Przeciągnij — orbita · kółko — zbliżenie</span></div>}
      </aside>
      <div className="legend"><span><i className="umbra"/>Umbra</span><span><i className="penumbra"/>Penumbra</span><span>Przeciągnij · obrót</span><span>Scroll · zoom</span></div>
    </section>
    <footer><span>THREE.JS / R3F · PHYSICALLY BASED SHADOWS</span><span>Dane: średnie promienie i okresy orbitalne · epoka poglądowa</span></footer>
  </main>
}
createRoot(document.getElementById('root')).render(<App/>)
