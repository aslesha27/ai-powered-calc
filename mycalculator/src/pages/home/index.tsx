import { ColorSwatch, Group } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { SWATCHES } from '@/constants';
import {
  DndContext,
  useDraggable,
  useSensor,
  useSensors,
  PointerSensor
} from '@dnd-kit/core';

interface GeneratedResult {
  expression: string;
  answer: string;
}

interface Response {
  expr: string;
  result: string;
  assign: boolean;
}

function DraggableLatex({ id, latex, position, onDragEnd }: any) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : `translate(${position.x}px, ${position.y}px)`
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, position: 'absolute', padding: '0.5rem', color: 'white' }}
      {...listeners}
      {...attributes}
    >
      <div className="latex-content">{latex}</div>
    </div>
  );
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('rgb(255, 255, 255)');
  const [reset, setReset] = useState(false);
  const [dictOfVars, setDictOfVars] = useState({});
  const [result, setResult] = useState<GeneratedResult>();
  const [latexExpressions, setLatexExpressions] = useState<Array<{ id: string, latex: string, position: { x: number, y: number } }>>([]);

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    if (reset) {
      resetCanvas();
      setLatexExpressions([]);
      setResult(undefined);
      setDictOfVars({});
      setReset(false);
    }
  }, [reset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - canvas.offsetTop;
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
      }
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/config/TeX-MML-AM_CHTML.js';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.MathJax.Hub.Config({
        tex2jax: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
      });
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const renderLatexToCanvas = (expression: string, answer: string, position: { x: number, y: number }) => {
    const latex = `${expression} = ${answer}`;
    const id = `${Date.now()}`;
    setLatexExpressions((prev) => [...prev, { id, latex, position }]);
  };

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.background = 'black';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        setIsDrawing(true);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = color;
        ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const runRoute = async () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/calculate`, {
        image: canvas.toDataURL('image/png'),
        dict_of_vars: dictOfVars
      });

      const resp = await response.data;
      resp.data.forEach((data: Response) => {
        if (data.assign === true) {
          setDictOfVars((prev) => ({ ...prev, [data.expr]: data.result }));
        }
      });

      const ctx = canvas.getContext('2d');
      const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (imageData.data[i + 3] > 0) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      resp.data.forEach((data: Response) => {
        setTimeout(() => {
          setResult({ expression: data.expr, answer: data.result });
          renderLatexToCanvas(data.expr, data.result, { x: centerX, y: centerY });
        }, 1000);
      });
    }
  };

  return (
    <>
      <div className='grid grid-cols-3 gap-2'>
        <Button
          onClick={() => setReset(true)}
          className='z-20 bg-black text-white'
          variant='default'
          color='black'
        >
          Reset
        </Button>
        <Group className='z-20'>
          {SWATCHES.map((swatch) => (
            <ColorSwatch key={swatch} color={swatch} onClick={() => setColor(swatch)} />
          ))}
        </Group>
        <Button
          onClick={runRoute}
          className='z-20 bg-black text-white'
          variant='default'
          color='white'
        >
          Run
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        id='canvas'
        className='absolute top-0 left-0 w-full h-full'
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
      />

      <DndContext sensors={sensors}>
        {latexExpressions.map((item) => (
          <DraggableLatex
            key={item.id}
            id={item.id}
            latex={item.latex}
            position={item.position}
            onDragEnd={() => {}}
          />
        ))}
      </DndContext>
    </>
  );
}
