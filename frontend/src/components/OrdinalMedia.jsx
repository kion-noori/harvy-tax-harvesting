// frontend/src/components/OrdinalMedia.jsx
import React, { useEffect, useMemo, useState } from 'react';
import '@google/model-viewer';

/**
 * Shows an inscription using the right element based on its content_type.
 * Uses contentUri/previewUri from Magic Eden's ord-mirror when available,
 * falls back to ordinals.com.
 */
export default function OrdinalMedia({ id, contentType, contentUri, previewUri, offchainImage, collectionName }) {
  const needsProbing = !contentType || contentType === '' || contentType === 'null';
  const [ctype, setCtype] = useState(needsProbing ? null : contentType);
  const [error, setError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [textContent, setTextContent] = useState(null);
  const [srcIndex, setSrcIndex] = useState(0);

  const sources = useMemo(() => {
    const prefersPreview =
      ctype &&
      (
        ctype.startsWith('image/') ||
        ctype.startsWith('video/') ||
        ctype.startsWith('model/') ||
        ctype.startsWith('audio/') ||
        ctype.includes('svg')
      );

    const ordered = prefersPreview
      ? [previewUri, contentUri]
      : [contentUri, previewUri];

    ordered.push(`https://ordinals.com/content/${id}`);
    ordered.push(`https://api.hiro.so/ordinals/v1/inscriptions/${id}/content`);

    return ordered.filter((value, index, arr) => value && arr.indexOf(value) === index);
  }, [ctype, contentUri, id, previewUri]);

  const src = sources[srcIndex] || sources[0];

  useEffect(() => {
    setSrcIndex(0);
    setImageError(false);
    setError(false);
    setTextContent(null);
  }, [id, contentUri, previewUri, ctype]);

  const tryNextSource = () => {
    if (srcIndex < sources.length - 1) {
      setSrcIndex(prev => prev + 1);
    } else {
      setImageError(true);
      setError(true);
    }
  };

  // Probe content type if not provided
  useEffect(() => {
    if (!needsProbing || ctype) return;

    let alive = true;
    (async () => {
      // Try the primary source first
      const probeUrl = contentUri || `https://ordinals.com/content/${id}`;
      try {
        const response = await fetch(probeUrl, { method: 'HEAD' });
        if (response.ok && alive) {
          const detectedType = response.headers.get('content-type') || 'application/octet-stream';
          setCtype(detectedType);
          return;
        }
      } catch {}
      if (alive) setCtype('image/*');
    })();

    return () => { alive = false; };
  }, [id, needsProbing, ctype, contentUri]);

  // Fetch text content for text/* types
  useEffect(() => {
    if (ctype && ctype.startsWith('text/') && !ctype.startsWith('text/html')) {
      fetch(src)
        .then(r => r.text())
        .then(text => setTextContent(text))
        .catch(() => setError(true));
    }
  }, [ctype, src]);

  const renderPlaceholder = () => (
    <div style={{
      width: '100%',
      minHeight: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      borderRadius: 8,
      border: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#888',
      padding: '16px',
      textAlign: 'center'
    }}>
      {imageError ? (
        <>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Content unavailable</div>
          <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px' }}>
            {id.slice(0, 16)}...
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Loading...</div>
        </>
      )}
    </div>
  );

  if (!ctype) return renderPlaceholder();
  if (imageError || error) return renderPlaceholder();

  // HTML content — render in sandboxed iframe
  if (ctype && (ctype.startsWith('text/html') || ctype === 'text/javascript')) {
    return (
      <iframe
        key={`${id}-${srcIndex}`}
        src={src}
        title={`Inscription ${id}`}
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: '100%',
          minHeight: 300,
          height: '400px',
          border: 'none',
          borderRadius: 8,
          background: 'white'
        }}
        onError={tryNextSource}
      />
    );
  }

  // JSON and plain text inscriptions — use offchain image if available, otherwise show text content
  if (ctype && (ctype.startsWith('application/json') || (ctype.startsWith('text/') && !ctype.startsWith('text/html')))) {
    if (offchainImage) {
      return (
        <img
          key={`${id}-offchain`}
          src={offchainImage}
          alt={collectionName || `Inscription ${id}`}
          style={{ width: '100%', height: 'auto', objectFit: 'cover', borderRadius: 8 }}
          loading="lazy"
          decoding="async"
          onError={() => setImageError(true)}
        />
      );
    }
    // No collection image — show the text content directly
    return (
      <div style={{
        width: '100%',
        minHeight: 150,
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 8,
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ccc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        wordBreak: 'break-word'
      }}>
        {textContent || 'Loading...'}
      </div>
    );
  }

  // Images (but not SVG — handled separately below)
  if (ctype.startsWith('image/') && !ctype.includes('svg')) {
    return (
      <img
        key={`${id}-${srcIndex}`}
        src={src}
        alt={`Inscription ${id}`}
        style={{ width: '100%', height: 'auto', objectFit: 'cover', borderRadius: 8 }}
        loading="lazy"
        decoding="async"
        onError={tryNextSource}
      />
    );
  }

  // SVG — use object tag for interactive SVG, with fallback
  if (ctype.includes('svg')) {
    return (
      <object
        key={`${id}-${srcIndex}`}
        data={src}
        type={ctype}
        style={{ width: '100%', minHeight: 240, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.02)' }}
        onError={tryNextSource}
      >
        {renderPlaceholder()}
      </object>
    );
  }

  // Video
  if (ctype.startsWith('video/')) {
    return (
      <video
        key={`${id}-${srcIndex}`}
        src={src}
        controls
        playsInline
        preload="metadata"
        style={{ width: '100%', height: 'auto', objectFit: 'cover', borderRadius: 8 }}
        onError={tryNextSource}
      >
        <div style={{ padding: '16px', textAlign: 'center', color: '#888' }}>
          Video format not supported
        </div>
      </video>
    );
  }

  // 3D models
  if (ctype.startsWith('model/')) {
    return (
      <div style={{ width: '100%', minHeight: 300, position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
        <model-viewer
          src={src}
          alt={`3D Model ${id}`}
          auto-rotate
          camera-controls
          style={{
            width: '100%',
            height: '400px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
            borderRadius: 8
          }}
          loading="eager"
        />
      </div>
    );
  }

  // Audio
  if (ctype.startsWith('audio/')) {
    return (
      <div style={{
        width: '100%',
        minHeight: 150,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        borderRadius: 8,
        padding: '16px'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎵</div>
        <audio src={src} controls preload="metadata" style={{ width: '90%' }} />
      </div>
    );
  }

  // Unknown types — clean placeholder with link
  return (
    <div style={{
      width: '100%',
      minHeight: 150,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      borderRadius: 8,
      border: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#888',
      padding: '16px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
      <div style={{ fontSize: '12px', opacity: 0.8 }}>{ctype.split('/')[0]} inscription</div>
      <a
        href={`https://ordinals.com/inscription/${id}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ fontSize: '10px', color: '#F7931A', marginTop: '8px', textDecoration: 'none' }}
      >
        View on ordinals.com
      </a>
    </div>
  );
}
