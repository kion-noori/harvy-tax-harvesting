// frontend/src/components/OrdinalMedia.jsx
import React, { useEffect, useState } from 'react';
import '@google/model-viewer';

/**
 * Shows an inscription using the right element based on its content_type.
 * If contentType is provided, uses it immediately. Otherwise fetches from Hiro API.
 */
export default function OrdinalMedia({ id, contentType }) {
  // If contentType is null/undefined/empty, fetch from Hiro to get the real type
  // Empty string ('') means Hiro doesn't have the type, so we need to probe it
  const needsProbing = !contentType || contentType === '' || contentType === 'null';
  const [ctype, setCtype] = useState(needsProbing ? null : contentType);
  const [error, setError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [textContent, setTextContent] = useState(null);
  const [useFallback, setUseFallback] = useState(false);

  // Fetch metadata only for inscriptions with empty/null content_type
  useEffect(() => {
    if (!needsProbing || ctype) return; // Already have it or don't need it

    let alive = true;
    (async () => {
      try {
        // Try to get content-type by probing ordinals.com with HEAD request
        const response = await fetch(`https://ordinals.com/content/${id}`, { method: 'HEAD' });
        if (response.ok && alive) {
          const detectedType = response.headers.get('content-type') || 'application/octet-stream';
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Probed content-type for ${id}:`, detectedType);
          }
          setCtype(detectedType);
        } else if (alive) {
          // Fallback to image if probe fails
          setCtype('image/*');
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Probe failed for ${id}, defaulting to image`);
        }
        if (alive) setCtype('image/*');
      }
    })();

    return () => { alive = false; };
  }, [id, needsProbing, ctype]);

  // Fetch text content when content type is text (use direct URL)
  useEffect(() => {
    if (ctype && ctype.startsWith('text/')) {
      const src = `https://ordinals.com/content/${id}`;
      fetch(src)
        .then(r => r.text())
        .then(text => setTextContent(text))
        .catch(() => setError(true));
    }
  }, [ctype, id]);

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

  if (!ctype) {
    return renderPlaceholder();
  }

  // Show placeholder if previous load attempt failed
  if (imageError || error) {
    return renderPlaceholder();
  }

  // Use direct ordinals.com URLs first, fallback to Hiro API if needed
  const ordinalsSrc = `https://ordinals.com/content/${id}`;
  const hiroSrc = `https://api.hiro.so/ordinals/v1/inscriptions/${id}/content`;
  const src = useFallback ? hiroSrc : ordinalsSrc;

  // Handle HTML content with iframe for interactive rendering
  // SECURITY: Strict sandbox to prevent XSS attacks from malicious inscriptions
  if (ctype && (ctype.startsWith('text/html') || ctype === 'text/javascript')) {
    return (
      <iframe
        key={`${id}-${useFallback ? 'hiro' : 'ordinals'}`}
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
        onError={() => {
          if (!useFallback) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔄 Trying Hiro API fallback for HTML ${id}`);
            }
            setUseFallback(true);
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.error(`❌ HTML/JS load failed for ${id} from both sources`);
            }
            setError(true);
          }
        }}
      />
    );
  }

  // Handle plain text content (BRC-20 tokens, etc.)
  if (ctype && ctype.startsWith('text/')) {
    return (
      <div style={{
        width: '100%',
        minHeight: 150,
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 8,
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#aaa',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {textContent || 'Loading text...'}
      </div>
    );
  }

  if (ctype.startsWith('image/')) {
    return (
      <img
        key={`${id}-${useFallback ? 'hiro' : 'ordinals'}`}
        src={src}
        alt={`Inscription ${id}`}
        style={{ width: '100%', height: 'auto', objectFit: 'cover', borderRadius: 8 }}
        loading="lazy"
        onLoad={() => {
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Image loaded: ${id} from ${useFallback ? 'Hiro' : 'ordinals.com'}`);
          }
        }}
        onError={(e) => {
          if (!useFallback) {
            // Try Hiro API as fallback
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔄 Trying Hiro API fallback for ${id}`);
            }
            setUseFallback(true);
          } else {
            // Both sources failed
            if (process.env.NODE_ENV === 'development') {
              console.error(`❌ Image load failed for ${id} from both sources`);
            }
            setImageError(true);
            e.currentTarget.style.display = 'none';
          }
        }}
      />
    );
  }

  if (ctype.startsWith('video/')) {
    return (
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        style={{ width: '100%', height: 'auto', objectFit: 'cover', borderRadius: 8 }}
        onError={() => {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Video load failed for ${id}`);
          }
          setError(true);
        }}
      >
        <div style={{ padding: '16px', textAlign: 'center', color: '#888' }}>
          Video format not supported
        </div>
      </video>
    );
  }

  // Handle 3D models (GLTF, GLB) with interactive viewer
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
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.7)',
          borderRadius: 4,
          fontSize: '10px',
          color: '#aaa'
        }}>
          {ctype}
        </div>
      </div>
    );
  }

  // SVG, audio, or unknown: render in <object> with fallback
  return (
    <object
      data={src}
      type={ctype}
      style={{ width: '100%', minHeight: 240, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.02)' }}
      onError={() => setError(true)}
    >
      {renderPlaceholder()}
    </object>
  );
}
