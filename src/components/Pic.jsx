import { useEffect, useState } from 'react';
import { imageUrl } from '../lib/images.js';

// A word's picture, or nothing while it loads or when the word has none. Decorative: the word itself is the text,
// and a description could give the answer away.
export default function Pic({ base, file, className }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (file) imageUrl(base, file).then(u => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [base, file]);
  return url ? <img className={'pic ' + (className || '')} src={url} alt="" aria-hidden="true" draggable="false" /> : null;
}
