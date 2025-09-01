import React, { useState, useRef, useEffect } from 'react';

interface TreeSelectorProps {
  currentTreeId: string | null;
  availableTrees: string[];
  currentTreeName?: string;
  onTreeChange: (treeId: string) => void;
  onCreateNewTree: () => void;
  onDeleteTree?: (treeId: string) => void;
  loading?: boolean;
}

export const TreeSelector: React.FC<TreeSelectorProps> = ({
  currentTreeId,
  availableTrees,
  currentTreeName,
  onTreeChange,
  onCreateNewTree,
  onDeleteTree,
  loading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleTreeSelect = (treeId: string) => {
    onTreeChange(treeId);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    onCreateNewTree();
    setIsOpen(false);
  };

  const handleDeleteTree = (treeId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent tree selection
    
    if (!onDeleteTree) return;
    
    const treeName = formatTreeName(treeId);
    if (confirm(`Are you sure you want to delete the tree "${treeName}"? This action cannot be undone.`)) {
      onDeleteTree(treeId);
      setIsOpen(false);
    }
  };

  const displayName = currentTreeName || (currentTreeId ? formatTreeName(currentTreeId) : 'No Tree');

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        style={{
          background: 'rgba(45, 45, 45, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-primary)',
          borderRadius: '12px',
          padding: '12px 16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          color: 'var(--text-primary)',
          fontSize: '1.2rem',
          fontWeight: '500',
          cursor: loading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: '160px',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.background = 'rgba(55, 55, 55, 0.9)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(45, 45, 45, 0.9)';
          e.currentTarget.style.borderColor = 'var(--border-primary)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{loading ? 'Loading...' : displayName}</span>
        </div>
        <span style={{ 
          fontSize: '0.8rem', 
          transition: 'transform 0.2s ease',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
        }}>
          ▼
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && !loading && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          background: 'rgba(45, 45, 45, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-primary)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          zIndex: 1000,
          minWidth: '100%',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {/* Available Trees */}
          {availableTrees.length > 0 && (
            <>
              <div style={{
                padding: '8px 12px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                borderBottom: '1px solid var(--border-secondary)',
                fontWeight: '500'
              }}>
                Available Trees
              </div>
              {availableTrees.map((treeId) => (
                <div
                  key={treeId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: currentTreeId === treeId ? 'var(--accent-primary)' : 'transparent',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (currentTreeId !== treeId) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentTreeId !== treeId) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <button
                    onClick={() => handleTreeSelect(treeId)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: currentTreeId === treeId ? 'white' : 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>{currentTreeId === treeId ? '✓' : ' '}</span>
                    <span>{formatTreeName(treeId)}</span>
                  </button>
                  
                  {/* Delete button - only show if not current tree and delete handler exists */}
                  {treeId !== currentTreeId && onDeleteTree && availableTrees.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteTree(treeId, e)}
                      style={{
                        padding: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '24px',
                        borderRadius: '4px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(220, 53, 69, 0.1)';
                        e.currentTarget.style.color = '#dc3545';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                      title={`Delete ${formatTreeName(treeId)}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </>
          )}

          {/* No Trees Message */}
          {availableTrees.length === 0 && (
            <div style={{
              padding: '16px 12px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem'
            }}>
              No trees available
            </div>
          )}

          {/* Create New Tree */}
          <div style={{
            borderTop: availableTrees.length > 0 ? '1px solid var(--border-secondary)' : 'none',
            padding: '4px'
          }}>
            <button
              onClick={handleCreateNew}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-primary)',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(82, 196, 26, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span>+</span>
              <span>Create New Tree</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to format tree names nicely
function formatTreeName(treeId: string): string {
  if (treeId === 'default') return 'My Tasks';
  
  // Convert snake_case or kebab-case to Title Case
  return treeId
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
