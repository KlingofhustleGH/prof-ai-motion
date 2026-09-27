# 3D на Three.js

## Подключение
- Three.js локально: `node scripts/vendor-three.mjs work/assets/three`.
- В композиции importmap:
  `{"imports":{"three":"./assets/three/three.module.js","three/addons/":"./assets/three/addons/"}}`
- Рендерер: `antialias:true, alpha:true, preserveDrawingBuffer:true`, `setPixelRatio(1)`, размер = кадр, `ACESFilmicToneMapping`, экспозиция 1,3–1,6.
- Рендер браузера без окна идёт через программный WebGL (SwiftShader) — это нормально, ~0,5–1 с на кадр.
- Состояние сцены выставляется из `t` внутри `renderFrame`, потом `renderer.render(scene, camera)`. Никаких анимационных циклов.

## Хром, который выглядит как хром
Светлое окружение даёт плоский сиреневый металл. Нужна **тёмная студия**:
- сфера-комната почти чёрного цвета (`BackSide`);
- 4–5 плоскостей-«софтбоксов» с яркостью больше 1 (`new THREE.Color(9,9,10)`), синяя и фиолетовая полосы по бокам;
- `PMREMGenerator.fromScene(envScene, .015)` → `scene.environment`.
- Материал: `MeshPhysicalMaterial({metalness:1, roughness:.08, iridescence:.9, clearcoat:1})`.
- Блик: `PointLight`, который проезжает поперёк букв за 0,8 с.

## 3D-текст
- `FontLoader` + `TextGeometry`, шрифт — typeface JSON (в Three есть `helvetiker_bold`, только латиница).
- Кириллица в 3D — нужен свой typeface JSON (конвертация TTF через facetype.js). Иначе делай кириллицу обычным текстом, а в 3D — латиницу/цифры.
- Вписывай по ширине: посчитай `boundingBox` и масштабируй под нужную ширину в единицах сцены.

## Эквалайзер из звука
- `InstancedMesh` из боксов (32 полосы × 30–40 рядов), материал без тонмаппинга (`toneMapped:false`), цвет по высоте.
- Высота = `band(кадр − ряд*2, полоса)` из `spectrum.json` (`scripts/analyze.mjs` по **финальному** миксу).
- Камера отъезжает и чуть облетает; `fov` 40–50. Проверь на стоп-кадре, что столбики не перекрывают заголовок.

## Лента плёнки
- 18 групп: плоскость-кадр с текстурой клипа + подложка с перфорацией (CanvasTexture).
- Позиции по спирали вокруг оси Z, камера летит **по оси** (иначе пролетает сквозь кадры).
- Текстуры клипов обновляй каждый кадр: `tex.image = img; tex.needsUpdate = true`.
- Финал: позиции интерполируются в сетку-таймлайн, камера отъезжает.

## Осколки
- Клипы таймлайна — боксы; в момент удара у каждого посеянная скорость, вращение и гравитация: `p = p0 + v*dt + g*dt²`.
