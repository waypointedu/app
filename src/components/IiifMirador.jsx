import { useEffect, useRef } from 'react';

const IiifMirador = ({ manifest }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!manifest || !containerRef.current) return;
    import('mirador')
      .then((module) => {
        const createMirador = module?.default ?? module;
        if (typeof createMirador !== 'function') return;
        createMirador({
          id: containerRef.current.id,
          windows: [
            {
              loadedManifest: manifest
            }
          ]
        });
      })
      .catch((error) => {
        console.error('Failed to load Mirador viewer', error);
      });
  }, [manifest]);

  return <div id="mirador-viewer" ref={containerRef} className="h-[70vh] w-full" />;
};

export default IiifMirador;
