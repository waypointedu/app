import { useEffect, useRef } from 'react';

const IiifMirador = ({ manifest }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!manifest || !containerRef.current) return;
    import('mirador').then((Mirador) => {
      Mirador.default({
        id: containerRef.current.id,
        windows: [
          {
            loadedManifest: manifest
          }
        ]
      });
    });
  }, [manifest]);

  return <div id="mirador-viewer" ref={containerRef} className="h-[70vh] w-full" />;
};

export default IiifMirador;
