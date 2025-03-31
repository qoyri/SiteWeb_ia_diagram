"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  Panel,
  useReactFlow,
} from "reactflow"
import "reactflow/dist/style.css"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, Maximize, Minimize, RefreshCw } from "lucide-react"
import dagre from "dagre"
import { motion } from "framer-motion"

// Custom node types
const nodeTypes = {}

interface DiagramVisualizerProps {
  data: any
}

// Fonction pour organiser automatiquement le graphe
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "TB") => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction })

  // Définir les dimensions des nœuds pour le calcul de la disposition
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 180, height: 60 })
  })

  // Ajouter les arêtes au graphe
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  // Calculer la disposition
  dagre.layout(dagreGraph)

  // Appliquer les positions calculées aux nœuds
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 90, // Centrer le nœud (largeur/2)
        y: nodeWithPosition.y - 30, // Centrer le nœud (hauteur/2)
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

export default function DiagramVisualizer({ data }: DiagramVisualizerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [animationSpeed, setAnimationSpeed] = useState(1)
  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [layoutDirection, setLayoutDirection] = useState("TB") // TB = top to bottom, LR = left to right
  const containerRef = useRef<HTMLDivElement>(null)
  const { fitView, zoomIn: flowZoomIn, zoomOut: flowZoomOut } = useReactFlow()

  // Fonction pour basculer en mode plein écran
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullscreen(false)
      }
    }
  }

  // Écouter l'événement de sortie du mode plein écran
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false)
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Process the input data to create nodes and edges
  const processData = useCallback(() => {
    let processedNodes: Node[] = []
    let processedEdges: Edge[] = []

    // Process nodes
    if (data.nodes && Array.isArray(data.nodes)) {
      processedNodes = data.nodes.map((node: any) => ({
        id: node.id.toString(),
        type: node.type || "default",
        data: { label: node.label || node.id.toString(), ...node.data },
        position: node.position || { x: 0, y: 0 },
        style: {
          opacity: 0,
          ...node.style,
        },
      }))
    }

    // Process edges
    if (data.edges && Array.isArray(data.edges)) {
      processedEdges = data.edges.map((edge: any) => ({
        id: edge.id.toString(),
        source: edge.source.toString(),
        target: edge.target.toString(),
        type: edge.type || "default",
        animated: edge.animated || false,
        label: edge.label || "",
        style: { opacity: 0, ...edge.style },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          ...edge.markerEnd,
        },
      }))
    }

    // Appliquer la disposition automatique
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      processedNodes,
      processedEdges,
      layoutDirection,
    )

    return { nodes: layoutedNodes, edges: layoutedEdges }
  }, [data, layoutDirection])

  // Changer la direction de la disposition
  const changeLayout = (direction: string) => {
    setLayoutDirection(direction)
    resetAnimation()
  }

  // Reset animation
  const resetAnimation = useCallback(() => {
    const { nodes: processedNodes, edges: processedEdges } = processData()
    setNodes(processedNodes)
    setEdges(processedEdges)
    setProgress(0)
    setIsPlaying(true)

    // Ajuster la vue après un court délai pour s'assurer que les nœuds sont rendus
    setTimeout(() => {
      fitView({ padding: 0.2 })
    }, 50)
  }, [processData, setNodes, setEdges, fitView])

  // Animation effect
  useEffect(() => {
    resetAnimation()
  }, [data, resetAnimation])

  // Animation loop
  useEffect(() => {
    if (!isPlaying || nodes.length === 0) return

    const animationDuration = 2000 / animationSpeed // Base duration adjusted by speed
    const totalElements = nodes.length + edges.length
    let currentProgress = progress

    const interval = setInterval(() => {
      if (currentProgress >= totalElements) {
        setIsPlaying(false)
        clearInterval(interval)
        return
      }

      // Update nodes first, then edges
      if (currentProgress < nodes.length) {
        setNodes((nds) =>
          nds.map((node, index) => {
            if (index === currentProgress) {
              return {
                ...node,
                style: { ...node.style, opacity: 1 },
              }
            }
            return node
          }),
        )
      } else {
        const edgeIndex = currentProgress - nodes.length
        setEdges((eds) =>
          eds.map((edge, index) => {
            if (index === edgeIndex) {
              return {
                ...edge,
                style: { ...edge.style, opacity: 1 },
                animated: true,
              }
            }
            return edge
          }),
        )
      }

      currentProgress++
      setProgress(currentProgress)
    }, animationDuration / totalElements)

    return () => clearInterval(interval)
  }, [isPlaying, nodes.length, edges.length, progress, animationSpeed, setNodes, setEdges])

  return (
    <motion.div
      className="w-full h-full flex flex-col rounded-lg overflow-hidden border border-border"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      ref={containerRef}
    >
      <div className={`flex-grow ${isFullscreen ? "h-screen" : "h-[400px]"}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable className="bg-background/80 rounded-lg border border-border" />
          <Background variant="dots" gap={12} size={1} className="bg-muted/30" />

          <Panel position="top-right" className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
              className="bg-background/80 backdrop-blur-sm"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => flowZoomIn()}
              className="bg-background/80 backdrop-blur-sm"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => flowZoomOut()}
              className="bg-background/80 backdrop-blur-sm"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </Panel>

          <Panel position="top-left" className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeLayout("TB")}
              className={`bg-background/80 backdrop-blur-sm ${layoutDirection === "TB" ? "border-primary" : ""}`}
            >
              Vertical
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeLayout("LR")}
              className={`bg-background/80 backdrop-blur-sm ${layoutDirection === "LR" ? "border-primary" : ""}`}
            >
              Horizontal
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      <Card
        className={`${isFullscreen ? "absolute bottom-0 left-0 right-0 m-4 bg-background/90 backdrop-blur-sm" : "mt-4"}`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={resetAnimation} aria-label="Reset">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => resetAnimation()} aria-label="Réorganiser">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="flex-grow">
              <Slider
                value={[animationSpeed]}
                min={0.5}
                max={3}
                step={0.5}
                onValueChange={(value) => setAnimationSpeed(value[0])}
                aria-label="Animation speed"
              />
            </div>
            <span className="text-sm text-muted-foreground">Vitesse: {animationSpeed}x</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

