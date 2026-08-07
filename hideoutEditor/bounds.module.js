import * as THREE from "three"
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import * as constants from "hideoutEditor/constants.module.js"

const svgLoader = new SVGLoader()
const material = new THREE.LineBasicMaterial({ color: 0xFF8888 })
const allBoundsGroup = new THREE.Group()
allBoundsGroup.name = "Bounds"
allBoundsGroup.layers.set(constants.LAYER_GIZMOS)
allBoundsGroup.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)

export const boundsDefinitions = [
  {
    hash: "13526",
    name: "Felled Hideout",
    url: "obj/felled_13526.svg",
  },
  {
    hash: "26805",
    name: "Shrine Hideout",
    url: "obj/shrine_26805.svg",
  },
  {
    hash: "60415",
    name: "Canal Hideout",
    url: "obj/canal_60415.svg",
  },
  {
    hash: "12394",
    name: "Limestone Hideoout",
    url: "obj/limestone_12394.svg",
  },
]

const makeObjectSvg = (svg) => {
  const group = new THREE.Group()
  const paths = svg.paths
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]
    const shapes = SVGLoader.createShapes(path)
    for (let j = 0; j < shapes.length; j++) {
      const geometry = new THREE.ShapeGeometry(shapes[j])
      // rotate onto xz plane
      geometry.rotateX(Math.PI / 2)
      const edges = new THREE.EdgesGeometry(geometry)
      const lines = new THREE.LineSegments(edges, material)
      group.add(lines)
    }
  }
  return group
}

export const loadBounds = async (scene) => {
  for (let item of boundsDefinitions) {
    const svg = await svgLoader.loadAsync(item.url)
    const object = makeObjectSvg(svg)
    object.name = item.hash
    object.visible = false
    object.layers.set(constants.LAYER_GIZMOS)
    allBoundsGroup.add(object)
  }
  scene.add(allBoundsGroup)
}

export const showBounds = (hash) => {
  for (let item of allBoundsGroup.children) {
    item.visible = ("" + hash) === item.name
  }
}

export const getBoundsDefinition = (hash) => {
  for (let item of boundsDefinitions) {
    if (("" + hash) === item.hash) {
      return item
    }
  }
}
