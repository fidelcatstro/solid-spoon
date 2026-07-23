import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { Move, Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react';
import type { GaugePosition } from '@shared/schema';

interface DraggableGaugeProps {
  id: string;
  position: GaugePosition;
  editMode: boolean;
  onPositionChange: (id: string, position: Partial<GaugePosition>) => void;
  children: ReactNode;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | null;

const MIN_WIDTH = 80;
const MIN_HEIGHT = 60;

export function DraggableGauge({ 
  id, 
  position, 
  editMode, 
  onPositionChange, 
  children,
}: DraggableGaugeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [resizeSize, setResizeSize] = useState<{ width: number; height: number; x: number; y: number } | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const dragDataRef = useRef<{ 
    offsetX: number; 
    offsetY: number; 
    parentRect: DOMRect | null;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  }>({
    offsetX: 0,
    offsetY: 0,
    parentRect: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });
  
  const startDrag = useCallback((clientX: number, clientY: number) => {
    const rect = elementRef.current?.getBoundingClientRect();
    const parent = elementRef.current?.parentElement;
    const parentRect = parent?.getBoundingClientRect() || null;
    
    if (rect && parentRect) {
      dragDataRef.current = {
        ...dragDataRef.current,
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
        parentRect,
      };
      setDragPos({ x: position.x, y: position.y });
      setIsDragging(true);
    }
  }, [position.x, position.y]);

  const startResize = useCallback((clientX: number, clientY: number, handle: ResizeHandle) => {
    const parent = elementRef.current?.parentElement;
    const parentRect = parent?.getBoundingClientRect() || null;
    
    if (parentRect) {
      dragDataRef.current = {
        offsetX: clientX,
        offsetY: clientY,
        parentRect,
        startX: position.x,
        startY: position.y,
        startWidth: position.width,
        startHeight: position.height,
      };
      setResizeSize({ width: position.width, height: position.height, x: position.x, y: position.y });
      setActiveHandle(handle);
      setIsResizing(true);
    }
  }, [position.x, position.y, position.width, position.height]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editMode || isResizing) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag(e.clientX, e.clientY);
  }, [editMode, isResizing, startDrag]);
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!editMode || isResizing) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  }, [editMode, isResizing, startDrag]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    startResize(e.clientX, e.clientY, handle);
  }, [editMode, startResize]);

  const handleResizeTouchStart = useCallback((e: React.TouchEvent, handle: ResizeHandle) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    startResize(touch.clientX, touch.clientY, handle);
  }, [editMode, startResize]);
  
  useEffect(() => {
    if (!isDragging) return;
    
    const updatePosition = (clientX: number, clientY: number) => {
      const { offsetX, offsetY, parentRect } = dragDataRef.current;
      if (!parentRect) return;
      
      const newX = clientX - parentRect.left - offsetX;
      const newY = clientY - parentRect.top - offsetY;
      
      const gridSize = 8;
      const snappedX = Math.round(newX / gridSize) * gridSize;
      const snappedY = Math.round(newY / gridSize) * gridSize;
      
      const maxX = Math.max(0, parentRect.width - position.width);
      const maxY = Math.max(0, parentRect.height - position.height);
      
      setDragPos({
        x: Math.max(0, Math.min(snappedX, maxX)),
        y: Math.max(0, Math.min(snappedY, maxY)),
      });
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      updatePosition(e.clientX, e.clientY);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      updatePosition(touch.clientX, touch.clientY);
    };
    
    const handleEnd = () => {
      setIsDragging(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDragging, position.width, position.height]);

  useEffect(() => {
    if (!isResizing || !activeHandle) return;
    
    const updateSize = (clientX: number, clientY: number) => {
      const { offsetX, offsetY, parentRect, startX, startY, startWidth, startHeight } = dragDataRef.current;
      if (!parentRect) return;
      
      const deltaX = clientX - offsetX;
      const deltaY = clientY - offsetY;
      
      const gridSize = 8;
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startX;
      let newY = startY;
      
      if (activeHandle === 'se') {
        newWidth = Math.max(MIN_WIDTH, startWidth + deltaX);
        newHeight = Math.max(MIN_HEIGHT, startHeight + deltaY);
      } else if (activeHandle === 'sw') {
        newWidth = Math.max(MIN_WIDTH, startWidth - deltaX);
        newHeight = Math.max(MIN_HEIGHT, startHeight + deltaY);
        newX = startX + (startWidth - newWidth);
      } else if (activeHandle === 'ne') {
        newWidth = Math.max(MIN_WIDTH, startWidth + deltaX);
        newHeight = Math.max(MIN_HEIGHT, startHeight - deltaY);
        newY = startY + (startHeight - newHeight);
      } else if (activeHandle === 'nw') {
        newWidth = Math.max(MIN_WIDTH, startWidth - deltaX);
        newHeight = Math.max(MIN_HEIGHT, startHeight - deltaY);
        newX = startX + (startWidth - newWidth);
        newY = startY + (startHeight - newHeight);
      }
      
      newWidth = Math.round(newWidth / gridSize) * gridSize;
      newHeight = Math.round(newHeight / gridSize) * gridSize;
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
      
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);
      newWidth = Math.min(newWidth, parentRect.width - newX);
      newHeight = Math.min(newHeight, parentRect.height - newY);
      
      setResizeSize({ width: newWidth, height: newHeight, x: newX, y: newY });
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      updateSize(e.clientX, e.clientY);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      updateSize(touch.clientX, touch.clientY);
    };
    
    const handleEnd = () => {
      setIsResizing(false);
      setActiveHandle(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isResizing, activeHandle]);
  
  useEffect(() => {
    if (!isDragging && dragPos) {
      onPositionChange(id, { x: dragPos.x, y: dragPos.y });
      setDragPos(null);
    }
  }, [isDragging, dragPos, id, onPositionChange]);

  useEffect(() => {
    if (!isResizing && resizeSize) {
      onPositionChange(id, { 
        width: resizeSize.width, 
        height: resizeSize.height,
        x: resizeSize.x,
        y: resizeSize.y,
      });
      setResizeSize(null);
    }
  }, [isResizing, resizeSize, id, onPositionChange]);
  
  const toggleVisibility = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onPositionChange(id, { visible: !position.visible });
  }, [id, position.visible, onPositionChange]);

  const currentScale = position.scale ?? 100;

  const handleScaleUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newScale = Math.min(300, currentScale + 10);
    onPositionChange(id, { scale: newScale });
  }, [id, currentScale, onPositionChange]);

  const handleScaleDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newScale = Math.max(50, currentScale - 10);
    onPositionChange(id, { scale: newScale });
  }, [id, currentScale, onPositionChange]);
  
  if (!position.visible && !editMode) {
    return null;
  }
  
  const displayX = resizeSize?.x ?? dragPos?.x ?? position.x;
  const displayY = resizeSize?.y ?? dragPos?.y ?? position.y;
  const displayWidth = resizeSize?.width ?? position.width;
  const displayHeight = resizeSize?.height ?? position.height;
  
  const scaleFactor = currentScale / 100;
  
  const handleStyle = "absolute w-5 h-5 bg-primary border-2 border-background rounded-sm z-50 touch-none";
  
  return (
    <div
      ref={elementRef}
      className={`
        absolute select-none
        ${editMode ? 'cursor-move ring-2 ring-primary/50 rounded-md bg-card/10' : ''}
        ${isDragging || isResizing ? 'z-50 ring-primary opacity-90' : 'z-10'}
        ${!position.visible ? 'opacity-40' : ''}
      `}
      style={{
        left: displayX,
        top: displayY,
        width: displayWidth,
        height: displayHeight,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      data-testid={`draggable-gauge-${id}`}
    >
      {editMode && (
        <>
          <div className="absolute -top-7 left-0 right-0 flex items-center justify-between px-1 z-50">
            <div className="flex items-center gap-1.5 bg-background/95 px-2 py-0.5 rounded-sm border border-primary/30">
              <Move className="w-3 h-3 text-primary" />
              <span className="font-sans text-[10px] text-primary uppercase tracking-wide font-medium">{id}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleScaleDown}
                className="bg-background/95 px-1 py-0.5 rounded-sm border border-primary/30 text-primary hover:text-foreground transition-colors"
                data-testid={`button-scale-down-${id}`}
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="font-sans text-[9px] text-primary font-mono min-w-[28px] text-center" data-testid={`text-scale-${id}`}>
                {currentScale}%
              </span>
              <button
                onClick={handleScaleUp}
                className="bg-background/95 px-1 py-0.5 rounded-sm border border-primary/30 text-primary hover:text-foreground transition-colors"
                data-testid={`button-scale-up-${id}`}
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              <button
                onClick={toggleVisibility}
                className="bg-background/95 px-1 py-0.5 rounded-sm border border-primary/30 text-primary hover:text-foreground transition-colors ml-1"
                data-testid={`button-toggle-visibility-${id}`}
              >
                {position.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
            </div>
          </div>
          
          <div
            className={`${handleStyle} -top-2.5 -left-2.5 cursor-nwse-resize`}
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
            onTouchStart={(e) => handleResizeTouchStart(e, 'nw')}
            data-testid={`resize-handle-nw-${id}`}
          />
          <div
            className={`${handleStyle} -top-2.5 -right-2.5 cursor-nesw-resize`}
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
            onTouchStart={(e) => handleResizeTouchStart(e, 'ne')}
            data-testid={`resize-handle-ne-${id}`}
          />
          <div
            className={`${handleStyle} -bottom-2.5 -left-2.5 cursor-nesw-resize`}
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
            onTouchStart={(e) => handleResizeTouchStart(e, 'sw')}
            data-testid={`resize-handle-sw-${id}`}
          />
          <div
            className={`${handleStyle} -bottom-2.5 -right-2.5 cursor-nwse-resize`}
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
            onTouchStart={(e) => handleResizeTouchStart(e, 'se')}
            data-testid={`resize-handle-se-${id}`}
          />
        </>
      )}
      <div
        className="overflow-hidden pointer-events-none"
        style={{
          width: displayWidth,
          height: displayHeight,
        }}
      >
        <div
          style={{
            width: displayWidth / scaleFactor,
            height: displayHeight / scaleFactor,
            transform: `scale(${scaleFactor})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
