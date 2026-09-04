import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Network,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Target,
  CheckSquare,
  X,
  ArrowRight,
  Layers,
  Compass,
  Cpu
} from 'lucide-react';
import type { MemoryItem, GoalItem, TaskItem } from '../types';

interface MemoryGraphProps {
  memories: MemoryItem[];
  goals: GoalItem[];
  tasks: TaskItem[];
  onExploreInChat?: (prompt: string) => void;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'core' | 'category' | 'memory' | 'goal';
  category?: string;
  importance?: number;
  data?: any;
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface GraphEdge {
  from: string;
  to: string;
  color: string;
  dashed?: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; hex: string }> = {
  project: { bg: 'bg-indigo-950/80', border: 'border-indigo-500', hex: '#6366f1' },
  goal: { bg: 'bg-amber-950/80', border: 'border-amber-500', hex: '#f59e0b' },
  preference: { bg: 'bg-cyan-950/80', border: 'border-cyan-500', hex: '#06b6d4' },
  important_fact: { bg: 'bg-purple-950/80', border: 'border-purple-500', hex: '#a855f7' },
  recurring_theme: { bg: 'bg-emerald-950/80', border: 'border-emerald-500', hex: '#10b981' },
};

export const MemoryGraph: React.FC<MemoryGraphProps> = ({
  memories,
  goals,
  tasks,
  onExploreInChat,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  const categories = ['all', 'project', 'goal', 'preference', 'important_fact', 'recurring_theme'];

  // Filter memories
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [memories, selectedCategory, searchQuery]);

  // Generate Topological Graph Coordinates
  const { nodes, edges } = useMemo(() => {
    const calculatedNodes: GraphNode[] = [];
    const calculatedEdges: GraphEdge[] = [];

    const centerX = 450;
    const centerY = 350;

    // 1. Root Core Node
    calculatedNodes.push({
      id: 'root-user',
      label: 'YOU (Private Core)',
      type: 'core',
      x: centerX,
      y: centerY,
      radius: 28,
      color: '#6366f1',
    });

    // 2. Category Cluster Hubs
    const activeCategories = ['project', 'goal', 'preference', 'important_fact', 'recurring_theme'];
    const categoryHubRadius = 150;

    activeCategories.forEach((cat, index) => {
      const angle = (index / activeCategories.length) * 2 * Math.PI - Math.PI / 2;
      const catX = centerX + Math.cos(angle) * categoryHubRadius;
      const catY = centerY + Math.sin(angle) * categoryHubRadius;
      const catNodeId = `cat-${cat}`;

      calculatedNodes.push({
        id: catNodeId,
        label: cat.replace('_', ' ').toUpperCase(),
        type: 'category',
        category: cat,
        x: catX,
        y: catY,
        radius: 18,
        color: CATEGORY_COLORS[cat]?.hex || '#a855f7',
      });

      calculatedEdges.push({
        from: 'root-user',
        to: catNodeId,
        color: '#4f46e5',
        dashed: false,
      });

      // 3. Memory Nodes for this category
      const catMems = filteredMemories.filter((m) => m.category === cat);
      const memSpreadAngle = (2 * Math.PI) / activeCategories.length;
      const memRadius = 260;

      catMems.forEach((mem, mIdx) => {
        const offsetAngle =
          angle + (mIdx - (catMems.length - 1) / 2) * (memSpreadAngle / Math.max(catMems.length, 2));
        const memX = centerX + Math.cos(offsetAngle) * memRadius;
        const memY = centerY + Math.sin(offsetAngle) * memRadius;
        const memNodeId = `mem-${mem.id}`;

        const baseRadius = 12;
        const importanceBonus = (mem.importance || 0.5) * 6;

        calculatedNodes.push({
          id: memNodeId,
          label: mem.title,
          type: 'memory',
          category: cat,
          importance: mem.importance,
          data: mem,
          x: memX,
          y: memY,
          radius: baseRadius + importanceBonus,
          color: CATEGORY_COLORS[cat]?.hex || '#6366f1',
        });

        calculatedEdges.push({
          from: catNodeId,
          to: memNodeId,
          color: CATEGORY_COLORS[cat]?.hex || '#6366f1',
          dashed: true,
        });
      });
    });

    // 4. Linked Goals Integration
    goals.slice(0, 5).forEach((goal, gIdx) => {
      const gAngle = (gIdx / 5) * 2 * Math.PI + Math.PI / 4;
      const gRadius = 370;
      const gX = centerX + Math.cos(gAngle) * gRadius;
      const gY = centerY + Math.sin(gAngle) * gRadius;
      const gNodeId = `goal-${goal.id}`;

      calculatedNodes.push({
        id: gNodeId,
        label: goal.title,
        type: 'goal',
        data: goal,
        x: gX,
        y: gY,
        radius: 14,
        color: '#f59e0b',
      });

      // Connect to goal category hub
      calculatedEdges.push({
        from: 'cat-goal',
        to: gNodeId,
        color: '#f59e0b',
        dashed: false,
      });
    });

    return { nodes: calculatedNodes, edges: calculatedEdges };
  }, [filteredMemories, goals]);

  // Pan and Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag when clicking canvas background
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'graph-canvas-bg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  return (
    <div id="memory-graph-workspace" className="p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-2xl space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-100 tracking-tight">
              Cognitive Memory Topology
            </h3>
            <p className="text-xs text-neutral-400">
              Interactive structural map connecting long-term reflections, habits, and goals
            </p>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search cognitive nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-52"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Zoom & Reset Controls */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2.0))}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <Filter className="w-3 h-3 text-neutral-500 mr-1 shrink-0" />
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`text-xs px-2.5 py-1 rounded-lg capitalize font-medium transition-colors shrink-0 ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {cat.replace('_', ' ')}
          </button>
        ))}
        <span className="text-[11px] text-neutral-500 font-mono ml-auto shrink-0 hidden sm:inline">
          {filteredMemories.length} Memories • {goals.length} Goals
        </span>
      </div>

      {/* Interactive SVG Canvas */}
      <div
        ref={containerRef}
        id="graph-canvas-bg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative w-full h-[520px] rounded-xl bg-neutral-950 border border-neutral-800/80 overflow-hidden select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Subtle Background Coordinate Grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6366f1" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Scalable & Pannable SVG World */}
        <svg
          viewBox="0 0 900 700"
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          {/* Edge Lines */}
          {edges.map((edge, idx) => {
            const source = nodes.find((n) => n.id === edge.from);
            const target = nodes.find((n) => n.id === edge.to);
            if (!source || !target) return null;

            const isHighlighted =
              selectedNode?.id === source.id || selectedNode?.id === target.id;

            return (
              <line
                key={idx}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isHighlighted ? '#ffffff' : edge.color}
                strokeWidth={isHighlighted ? 2.5 : 1.2}
                strokeDasharray={edge.dashed ? '4 4' : undefined}
                opacity={isHighlighted ? 0.9 : 0.35}
                className="transition-all duration-300"
              />
            );
          })}

          {/* Node Circles */}
          {nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;

            return (
              <g
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className="cursor-pointer group"
              >
                {/* Node Ring Pulsing Glow on Highlight */}
                {isSelected && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.radius + 8}
                    fill="none"
                    stroke={node.color}
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    className="animate-spin"
                    style={{ transformOrigin: `${node.x}px ${node.y}px`, animationDuration: '6s' }}
                  />
                )}

                {/* Base Node Circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill={node.type === 'core' ? '#1e1b4b' : '#0a0a0a'}
                  stroke={node.color}
                  strokeWidth={isSelected ? 3 : node.type === 'core' ? 3 : 2}
                  className="transition-transform duration-200 group-hover:scale-110"
                />

                {/* Center Glyph or Dot */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius * 0.4}
                  fill={node.color}
                  opacity={node.type === 'core' ? 0.9 : 0.7}
                />

                {/* Node Label */}
                <text
                  x={node.x}
                  y={node.y + node.radius + 12}
                  textAnchor="middle"
                  fill={isSelected ? '#ffffff' : '#cbd5e1'}
                  fontSize={node.type === 'core' ? '12' : node.type === 'category' ? '10' : '9'}
                  fontWeight={node.type === 'core' || isSelected ? '700' : '500'}
                  className="pointer-events-none select-none tracking-tight"
                >
                  {node.label.length > 22 ? `${node.label.slice(0, 20)}...` : node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Instruction overlay pill */}
        <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-neutral-900/80 backdrop-blur-md border border-neutral-800 text-[11px] text-neutral-400 flex items-center gap-2 pointer-events-none">
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span>Click nodes to inspect • Drag to pan • Scroll/buttons to zoom</span>
        </div>
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="p-4 rounded-xl bg-neutral-950 border border-indigo-900/40 text-xs space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-100 text-sm">{selectedNode.label}</span>
                <span
                  className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border"
                  style={{
                    backgroundColor: `${selectedNode.color}20`,
                    borderColor: `${selectedNode.color}60`,
                    color: selectedNode.color,
                  }}
                >
                  {selectedNode.type}
                </span>
                {selectedNode.importance && (
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Weight: {Math.round(selectedNode.importance * 100)}%
                  </span>
                )}
              </div>

              {selectedNode.data?.content && (
                <p className="text-neutral-300 leading-relaxed max-w-3xl pt-1">
                  {selectedNode.data.content}
                </p>
              )}

              {selectedNode.data?.description && (
                <p className="text-neutral-300 leading-relaxed max-w-3xl pt-1">
                  {selectedNode.data.description}
                </p>
              )}
            </div>

            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Row */}
          {onExploreInChat && selectedNode.type !== 'core' && (
            <div className="pt-2 border-t border-neutral-850 flex items-center justify-between">
              <span className="text-[11px] text-neutral-500">
                Created: {new Date(selectedNode.data?.createdAt || Date.now()).toLocaleDateString()}
              </span>

              <button
                onClick={() =>
                  onExploreInChat(
                    `Let's explore the connections around my cognitive node: "${selectedNode.label}". What insights or strategies can you suggest?`
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-200 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Strategize with AURA</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
