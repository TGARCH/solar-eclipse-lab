import React, { Suspense, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import './styles.css'

const planets = [
  { name:'Merkury', r:0.12, orbit:4.1, speed:4.15, color:'#9d9a92' },
  { name:'Wenus', r:0.19, orbit:5.8, speed:1.62, color:'#d7ae72' },
  { name:'Ziemia', r:0.21, orbit:7.6, speed:1.0, color:'#4f87ff' },
  { name:'Mars', r:0.15, orbit:9.7, speed:0.53, color:'#c45d3c' },
  { name:'Jowisz', r:0.55, orbit:13.2, speed:0.084, color:'#d2a578' },
  { name:'Saturn', r:0.48, orbit:17.0, speed:0.034, color:'#dbc88d' },
  { name:'Uran', r:0.34, orbit:20.4, speed:0.012, color:'#9bd9dc' },
  { name:'Neptun', r:0.33, orbit:23.6, speed:0.0061, color:'#4269d8' }
]

function OrbitRing({radius}) {
  const pts = useMemo(() => Array.from({length:129},(_,i)=>{
    const a = i/128*Math.PI*2
    return [Math.cos(a)*radius,0,Math.sin(a)*radius]
  }),[radius])
  return <Line points={pts} color="#293143" transparent opacity={0.55} lineWidth={1}/>
}

function Planet({p, running, timeScale, selected, onSelect, earthRef}) {
  const group = useRef()
  const mesh = useRef()
  useFrame((_,dt)=>{
    if(running && group.current) group.current.rotation.y += dt * p.speed * 0.22 * timeScale
    if(mesh.current) mesh.current.rotation.y += dt*0.35
  })
  return <group ref={group}>
    <group position={[p.orbit,0,0]}>
      <mesh ref={mesh} onClick={(e)=>{e.stopPropagation();onSelect(p.name)}}>
        <sphereGeometry args={[p.r,32,32]}/>
        <meshStandardMaterial color={p.color} roughness={0.8} metalness={0.05}/>
      </mesh>
      {p.name==='Saturn' && <mesh rotation={[Math.PI/2,0,0]}>
        <ringGeometry args={[0.62,0.88,64]}/>
        <meshBasicMaterial color="#c9b57f" side={THREE.DoubleSide} transparent opacity={0.72}/>
      </mesh>}
      {selected===p.name && <Html distanceFactor={8}><div className="label3d">{p.name}</div></Html>}
      {p.name==='Ziemia' && <EarthMoonSystem running={running} timeScale={timeScale} earthRef={earthRef} />}
    </group>
  </group>
}

function EarthMoonSystem({running,timeScale,earthRef}){
  const moonOrbit = useRef()
  useFrame((_,dt)=>{ if(running && moonOrbit.current) moonOrbit.current.rotation.y += dt*2.9*timeScale })
  return <group ref={earthRef}>
    <group ref={moonOrbit}>
      <mesh position={[0.65,0,0]}>
        <sphereGeometry args={[0.058,20,20]}/><meshStandardMaterial color="#cfd2d5" roughness={1}/>
      </mesh>
    </group>
  </group>
}

function SolarSystem({running,timeScale,selected,setSelected}){
  const earthRef = useRef()
  return <>
    <ambientLight intensity={0.28}/>
    <pointLight position={[0,0,0]} intensity={110} distance={80} decay={1.7} color="#fff4d6"/>
    <mesh onClick={()=>setSelected('Słońce')}>
      <sphereGeometry args={[1.35,48,48]}/>
      <meshBasicMaterial color="#ffb21f"/>
    </mesh>
    {planets.map(p=><React.Fragment key={p.name}><OrbitRing radius={p.orbit}/><Planet p={p} running={running} timeScale={timeScale} selected={selected} onSelect={setSelected} earthRef={p.name==='Ziemia'?earthRef:undefined}/></React.Fragment>)}
  </>
}

function EclipseScene({progress}){
  const moonX = -1 + progress*2
  const sun = [-6,0,0], earth=[6,0,0], moon=[moonX*1.9,0,0]
  const cone = useMemo(()=>{
    const geo=new THREE.ConeGeometry(1.45,8,48,1,true)
    geo.translate(0,-4,0); geo.rotateZ(Math.PI/2)
    return geo
  },[])
  return <>
    <ambientLight intensity={0.2}/><pointLight position={sun} intensity={80} distance={50}/>
    <mesh position={sun}><sphereGeometry args={[1.35,48,48]}/><meshBasicMaterial color="#ffb21f"/></mesh>
    <mesh position={earth}><sphereGeometry args={[1,48,48]}/><meshStandardMaterial color="#3274d9" roughness={0.9}/></mesh>
    <mesh position={moon}><sphereGeometry args={[0.3,32,32]}/><meshStandardMaterial color="#c9c9c9"/></mesh>
    <mesh geometry={cone} position={[2.3,0,0]} rotation={[0,0,0]}>
      <meshBasicMaterial color="#151b28" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    <Line points={[sun,moon,earth]} color="#ffcb62" transparent opacity={0.5}/>
    <Html position={[0,-2.3,0]} center><div className="eclipse-note">Księżyc przechodzi między Słońcem a Ziemią. Cień pada na niewielki obszar powierzchni Ziemi.</div></Html>
  </>
}

function App(){
  const [mode,setMode]=useState('system')
  const [running,setRunning]=useState(true)
  const [timeScale,setTimeScale]=useState(1)
  const [selected,setSelected]=useState('Ziemia')
  const [progress,setProgress]=useState(0.5)
  return <main>
    <header>
      <div><span className="eyebrow">INTERAKTYWNE LABORATORIUM 3D</span><h1>Układ Słoneczny <em>i zaćmienie Słońca</em></h1></div>
      <div className="tabs"><button className={mode==='system'?'active':''} onClick={()=>setMode('system')}>Układ Słoneczny</button><button className={mode==='eclipse'?'active':''} onClick={()=>setMode('eclipse')}>Zaćmienie</button></div>
    </header>
    <section className="stage">
      <Canvas camera={{position:mode==='system'?[18,13,20]:[0,8,18],fov:46}} dpr={[1,1.6]}>
        <color attach="background" args={['#02040a']}/><Stars radius={80} depth={50} count={2200} factor={3} saturation={0}/>
        <Suspense fallback={null}>{mode==='system'?<SolarSystem running={running} timeScale={timeScale} selected={selected} setSelected={setSelected}/>:<EclipseScene progress={progress}/>}</Suspense>
        <OrbitControls enableDamping minDistance={4} maxDistance={50}/>
      </Canvas>
      <aside className="panel">
        {mode==='system'?<>
          <span className="section-kicker">STEROWANIE</span><h2>Model poglądowy</h2>
          <p>Rozmiary i odległości są celowo skompresowane, aby cały układ był czytelny. Proporcje prędkości orbitalnych zachowują zależności między planetami.</p>
          <button className="primary" onClick={()=>setRunning(v=>!v)}>{running?'Zatrzymaj ruch':'Uruchom ruch'}</button>
          <label>Tempo <b>{timeScale.toFixed(1)}×</b><input type="range" min="0.2" max="5" step="0.1" value={timeScale} onChange={e=>setTimeScale(+e.target.value)}/></label>
          <div className="selected"><small>WYBRANY OBIEKT</small><strong>{selected}</strong></div>
          <p className="hint">Przeciągnij, aby obrócić widok. Kółko myszy przybliża. Kliknij planetę, aby ją wskazać.</p>
        </>:<>
          <span className="section-kicker">MECHANIZM</span><h2>Dlaczego powstaje zaćmienie?</h2>
          <div className="steps"><div><b>1</b><span>Księżyc ustawia się pomiędzy Słońcem i Ziemią.</span></div><div><b>2</b><span>Blokuje część promieni słonecznych.</span></div><div><b>3</b><span>Stożek cienia trafia w powierzchnię Ziemi.</span></div></div>
          <label>Pozycja Księżyca<input type="range" min="0" max="1" step="0.01" value={progress} onChange={e=>setProgress(+e.target.value)}/></label>
          <div className="fact"><strong>Nie przy każdym nowiu.</strong><span>Orbita Księżyca jest nachylona względem płaszczyzny orbity Ziemi, więc idealne ustawienie występuje tylko wtedy, gdy Księżyc znajduje się blisko węzła swojej orbity.</span></div>
        </>}
      </aside>
    </section>
    <footer><span>Prototype: WebGL / Three.js</span><span>Przygotowane jako baza pod import GLB i dane z IFC</span></footer>
  </main>
}

createRoot(document.getElementById('root')).render(<App/>)
