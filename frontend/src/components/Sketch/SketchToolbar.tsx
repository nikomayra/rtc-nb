import '../../styles/components/sketch.css';

interface SketchToolbarProps {
  drawing: boolean;
  erasing: boolean;
  setDrawing: React.Dispatch<React.SetStateAction<boolean>>;
  setErasing: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SketchToolbar = ({ drawing, erasing, setDrawing, setErasing }: SketchToolbarProps) => {

  return (
    <div className='sketch-toolbar'>
      <button onClick={() => setDrawing(!drawing)}>Pen🖊️</button>
      <button onClick={() => setErasing(!erasing)}>Eraser🧹</button>
      <button>Undo🔄</button>
      <button>Redo↩️</button>
      <button>Save💾</button>
      <button>Clear🗑️</button>
    </div>
  );
};
