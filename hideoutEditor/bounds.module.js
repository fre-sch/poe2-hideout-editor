import * as constants from "hideoutEditor/constants.module.js"
import * as THREE from "three"
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'

const svgLoader = new SVGLoader()
const material = new THREE.LineBasicMaterial({ color: 0xFF8888 })
const visualByHash = {
  "13526": "obj/felled_13526.svg",
  "26805": "obj/shrine_26805.svg",
}

const makeObjectSvg = (svg) => {
  const group = new THREE.Group()
  const paths = svg.paths
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]
    const shapes = SVGLoader.createShapes(path)
    for (let j = 0; j < shapes.length; j++) {
      const geometry = new THREE.ShapeGeometry(shapes[i])
      // rotate onto xz plane
      geometry.rotateX(Math.PI / 2)
      const edges = new THREE.EdgesGeometry(geometry)
      const lines = new THREE.LineSegments(edges, material)
      group.add(lines)
    }
  }
  return group
}

export const loadBounds = async () => {
  for (let [hash, url] of Object.entries(visualByHash)) {
    const svg = await svgLoader.loadAsync(url)
    const obj = makeObjectSvg(svg)
    visualByHash[hash] = obj
  }
}

export const makeObject = (points) => {
  const vectors = points.map(it => new THREE.Vector2(it[0], it[1]))
  const shape = new THREE.Shape(vectors)
  const geometry = new THREE.ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)
  geometry.rotateY(-Math.PI / 2)

  const edges = new THREE.EdgesGeometry(geometry)
  const lines = new THREE.LineSegments(edges,
    new THREE.LineBasicMaterial({ color: 0xFF8888 })
  )
  lines.name = "Hideout Layout"
  return lines
}

export const fromHideoutHash = (hash) => {
  return visualByHash[hash]
}
