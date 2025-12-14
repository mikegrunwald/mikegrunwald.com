// Custom R2 Media Widget for Decap CMS
// Allows uploading to R2 and browsing existing R2 media

const R2MediaControl = window.createClass({
  getInitialState() {
    return {
      value: this.props.value || '',
      loading: false,
      error: null,
      uploading: false,
      uploadProgress: 0,
      existingFiles: [],
      loadingFiles: false,
      activeTab: 'upload', // 'upload' or 'browse'
      isLocalMode: this.detectLocalMode(),
      searchQuery: '',
    };
  },

  componentDidMount() {
    // Load existing R2 files
    this.loadExistingFiles();
  },

  detectLocalMode() {
    // Detect if we're running in local backend mode
    // In local mode, we'll show a helpful message about uploading
    try {
      const config = window.CMS?.getBackend?.()?.config;
      return config?.name === 'git-gateway' || config?.local_backend === true;
    } catch (e) {
      return false;
    }
  },

  async loadExistingFiles() {
    this.setState({ loadingFiles: true, error: null });

    try {
      // Try to fetch from API
      const response = await fetch('/api/r2/list-files?maxKeys=200');
      const data = await response.json();

      if (response.ok && data.files) {
        this.setState({
          existingFiles: data.files,
          loadingFiles: false,
        });
      } else {
        // Fallback to manifest if API fails
        this.loadFromManifest();
      }
    } catch (error) {
      console.warn('Failed to load R2 files from API, falling back to manifest:', error);
      this.loadFromManifest();
    }
  },

  loadFromManifest() {
    // Fallback: load from static manifest
    try {
      import('/src/lib/r2-manifest.js').then(module => {
        const files = (module.R2_FILES || []).map(path => {
          const publicUrl = `https://assets.mikegrunwald.com${path}`;
          return {
            key: path.substring(1), // Remove leading slash
            url: publicUrl,
            isImage: /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(path),
            isVideo: /\.(mp4|mov|webm)$/i.test(path),
            size: 0,
          };
        });
        this.setState({
          existingFiles: files,
          loadingFiles: false,
        });
      }).catch(() => {
        this.setState({ loadingFiles: false, existingFiles: [] });
      });
    } catch (error) {
      this.setState({ loadingFiles: false, existingFiles: [] });
    }
  },

  async handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.setState({ uploading: true, error: null, uploadProgress: 0 });

    try {
      // Get presigned URL
      console.log('[R2 Widget] Getting presigned URL for:', file.name, file.type);
      const presignResponse = await fetch('/api/r2/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          folder: file.type.startsWith('video/') ? 'video' : 'images',
        }),
      });

      if (!presignResponse.ok) {
        const errorData = await presignResponse.json();
        console.error('[R2 Widget] Presigned URL error:', errorData);
        throw new Error(errorData.error || 'Failed to get upload URL');
      }

      const { presignedUrl, publicUrl } = await presignResponse.json();
      console.log('[R2 Widget] Got presigned URL, uploading to R2...');

      // Upload to R2
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      console.log('[R2 Widget] Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('[R2 Widget] Upload failed:', errorText);
        throw new Error(`Failed to upload file to R2: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      // Update the field value
      this.setState({
        value: publicUrl,
        uploading: false,
        uploadProgress: 100,
        error: null,
      });

      this.props.onChange(publicUrl);

      // Refresh file list
      setTimeout(() => this.loadExistingFiles(), 1000);
    } catch (error) {
      console.error('[R2 Widget] Upload error:', error);

      // Check if it's a network error (CORS, etc)
      const errorMessage = error.message || 'Upload failed. Please try again.';
      const isNetworkError = error instanceof TypeError && errorMessage.includes('fetch');

      this.setState({
        uploading: false,
        uploadProgress: 0,
        error: isNetworkError
          ? 'Network error - check browser console for details. May be a CORS issue.'
          : errorMessage,
      });
    }
  },

  handleSelectExisting(file) {
    this.setState({ value: file.url, error: null });
    this.props.onChange(file.url);
  },

  handleUrlChange(e) {
    const value = e.target.value;
    this.setState({ value });
    this.props.onChange(value);
  },

  handleSearchChange(e) {
    this.setState({ searchQuery: e.target.value.toLowerCase() });
  },

  getFilteredFiles() {
    const { existingFiles, searchQuery } = this.state;
    if (!searchQuery) return existingFiles;

    return existingFiles.filter(file =>
      file.key.toLowerCase().includes(searchQuery)
    );
  },

  renderUploadTab() {
    const { uploading, uploadProgress, error, isLocalMode } = this.state;

    return window.h(
      'div',
      { style: { padding: '16px' } },

      // File input
      window.h(
        'div',
        { style: { marginBottom: '16px' } },
        window.h('input', {
          type: 'file',
          onChange: this.handleFileSelect,
          accept: 'image/*,video/*',
          disabled: uploading,
          style: {
            width: '100%',
            padding: '8px',
            border: '2px dashed #dfdfe3',
            borderRadius: '5px',
            cursor: uploading ? 'not-allowed' : 'pointer',
          },
        })
      ),

      // Upload progress
      uploading && window.h(
        'div',
        { style: { marginBottom: '16px' } },
        window.h(
          'div',
          { style: { fontSize: '14px', marginBottom: '8px', color: '#798291' } },
          'Uploading to R2...'
        ),
        window.h('div', {
          style: {
            height: '4px',
            background: '#e0e0e0',
            borderRadius: '2px',
            overflow: 'hidden',
          },
        }, window.h('div', {
          style: {
            height: '100%',
            background: '#3b82f6',
            width: `${uploadProgress}%`,
            transition: 'width 0.3s ease',
          },
        }))
      ),

      // Error message
      error && window.h(
        'div',
        {
          style: {
            padding: '12px',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '5px',
            color: '#c33',
            fontSize: '14px',
            marginBottom: '16px',
          },
        },
        error
      ),

      // Local mode info
      isLocalMode && window.h(
        'div',
        {
          style: {
            padding: '12px',
            background: '#e3f2fd',
            border: '1px solid #90caf9',
            borderRadius: '5px',
            color: '#1976d2',
            fontSize: '13px',
          },
        },
        window.h('strong', {}, 'Local Mode: '),
        'Files will upload to R2 when published. You can browse and select existing R2 files in the Browse tab.'
      )
    );
  },

  renderBrowseTab() {
    const { existingFiles, loadingFiles, searchQuery } = this.state;
    const filteredFiles = this.getFilteredFiles();

    return window.h(
      'div',
      { style: { padding: '16px' } },

      // Search
      window.h(
        'div',
        { style: { marginBottom: '16px' } },
        window.h('input', {
          type: 'text',
          placeholder: 'Search files...',
          value: searchQuery,
          onChange: this.handleSearchChange,
          style: {
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #dfdfe3',
            borderRadius: '5px',
            fontSize: '14px',
          },
        })
      ),

      // Loading state
      loadingFiles && window.h(
        'div',
        { style: { textAlign: 'center', padding: '24px', color: '#798291' } },
        'Loading files...'
      ),

      // File grid
      !loadingFiles && filteredFiles.length > 0 && window.h(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '12px',
            maxHeight: '400px',
            overflowY: 'auto',
          },
        },
        filteredFiles.map((file, index) =>
          window.h(
            'div',
            {
              key: index,
              onClick: () => this.handleSelectExisting(file),
              style: {
                border: '2px solid #dfdfe3',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: this.state.value === file.url ? '#e3f2fd' : '#fff',
                borderColor: this.state.value === file.url ? '#3b82f6' : '#dfdfe3',
              },
            },

            // Thumbnail/Icon
            window.h(
              'div',
              {
                style: {
                  width: '100%',
                  height: '80px',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                },
              },
              file.isImage
                ? window.h('img', {
                    src: file.url,
                    alt: file.key,
                    style: {
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'cover',
                    },
                  })
                : window.h(
                    'div',
                    {
                      style: {
                        fontSize: '32px',
                        color: '#798291',
                      },
                    },
                    file.isVideo ? '▶️' : '📄'
                  )
            ),

            // Filename
            window.h(
              'div',
              {
                style: {
                  fontSize: '11px',
                  color: '#798291',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
                title: file.key,
              },
              file.key.split('/').pop()
            )
          )
        )
      ),

      // Empty state
      !loadingFiles && filteredFiles.length === 0 && window.h(
        'div',
        {
          style: {
            textAlign: 'center',
            padding: '48px 24px',
            color: '#798291',
          },
        },
        window.h('div', { style: { fontSize: '48px', marginBottom: '16px' } }, '📁'),
        window.h('div', { style: { fontSize: '14px' } },
          searchQuery ? 'No files match your search' : 'No files in R2 yet'
        )
      )
    );
  },

  render() {
    const { forID, classNameWrapper } = this.props;
    const { value, activeTab } = this.state;

    return window.h(
      'div',
      { className: classNameWrapper },

      // Tabs
      window.h(
        'div',
        {
          style: {
            display: 'flex',
            borderBottom: '2px solid #dfdfe3',
            marginBottom: '0',
          },
        },
        ['upload', 'browse'].map(tab =>
          window.h(
            'button',
            {
              key: tab,
              onClick: () => this.setState({ activeTab: tab }),
              style: {
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                color: activeTab === tab ? '#3b82f6' : '#798291',
                borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                marginBottom: '-2px',
                textTransform: 'capitalize',
              },
            },
            tab === 'upload' ? 'Upload New' : 'Browse Existing'
          )
        )
      ),

      // Tab content
      window.h(
        'div',
        { style: { border: '1px solid #dfdfe3', borderTop: 'none', borderRadius: '0 0 5px 5px' } },
        activeTab === 'upload' ? this.renderUploadTab() : this.renderBrowseTab()
      ),

      // Current URL display/edit
      window.h(
        'div',
        { style: { marginTop: '16px' } },
        window.h(
          'label',
          {
            htmlFor: forID,
            style: {
              display: 'block',
              marginBottom: '4px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#798291',
            },
          },
          'Media URL'
        ),
        window.h('input', {
          id: forID,
          type: 'url',
          value: value,
          onChange: this.handleUrlChange,
          placeholder: 'https://assets.mikegrunwald.com/...',
          style: {
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #dfdfe3',
            borderRadius: '5px',
            fontSize: '14px',
            fontFamily: 'monospace',
          },
        })
      )
    );
  },
});

const R2MediaPreview = window.createClass({
  render() {
    const { value } = this.props;

    if (!value) {
      return window.h(
        'div',
        { style: { color: '#798291', fontSize: '14px', padding: '8px' } },
        'No media selected'
      );
    }

    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(value);
    const isVideo = /\.(mp4|mov|webm)$/i.test(value);

    return window.h(
      'div',
      { style: { padding: '8px' } },

      // Preview
      window.h(
        'div',
        {
          style: {
            marginBottom: '8px',
            background: '#f5f5f5',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            maxHeight: '200px',
          },
        },
        isImage
          ? window.h('img', {
              src: value,
              alt: 'Preview',
              style: { maxWidth: '100%', maxHeight: '180px', borderRadius: '4px' },
            })
          : isVideo
          ? window.h(
              'div',
              { style: { textAlign: 'center', color: '#798291' } },
              window.h('div', { style: { fontSize: '48px', marginBottom: '8px' } }, '▶️'),
              window.h('div', { style: { fontSize: '12px' } }, 'Video file')
            )
          : window.h(
              'div',
              { style: { textAlign: 'center', color: '#798291' } },
              window.h('div', { style: { fontSize: '48px', marginBottom: '8px' } }, '📄'),
              window.h('div', { style: { fontSize: '12px' } }, 'Media file')
            )
      ),

      // URL
      window.h(
        'div',
        {
          style: {
            fontSize: '12px',
            color: '#798291',
            wordBreak: 'break-all',
            fontFamily: 'monospace',
          },
        },
        value
      )
    );
  },
});

// Register the widget
window.CMS.registerWidget('r2-media', R2MediaControl, R2MediaPreview);
