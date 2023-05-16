import React from 'react';
import { Playground } from './Playground';
import './playground.css';
import { toUrl } from './share';

function App() {
  return (
    <div className="w-full h-full">
      <Playground onCopy={toUrl}/>
    </div>
  );
}

export default App;
