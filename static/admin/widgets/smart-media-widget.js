// Smart Media Widget for Decap CMS
// Smart routing based on file type and size:
// - Videos (all sizes) → R2 (video/ folder)
// - Large images (>25MB) → R2 (images/ folder)
// - Small images (<25MB) → Git (static/uploads/) with R2 fallback

import { isImagePath, isVideoPath } from '/src/lib/utils/media-utils.js';

const LARGE_FILE_THRESHOLD = 25 * 1024 * 1024; // 25MB threshold for routing decision

const SmartMediaControl = window.createClass({
  getInitialState() {
    return {
      value: this.props.value || '',
      loading: false,
      error: null,
      uploading: false,
      uploadProgress: 0,
      existingFiles: [],
      loadingFiles: false,
      activeTab: 'upload',
      searchQuery: '',
      fileType: null, // 'video', 'large-image', 'small-image'
      // Pagination state
      hasMore: false,
      nextContinuationToken: null,
      loadingMore: false,
      // Filter state
      selectedFileType: 'all', // 'all', 'images', 'videos'
      dateFilter: 'all', // 'all', '7days', '30days', '90days'
    };
  },

  componentDidMount() {
    // Load existing R2 files for browsing
    this.loadExistingFiles();
  },

  async loadExistingFiles() {
    this.setState({ loadingFiles: true, error: null });

    try {
      const response = await fetch('/api/r2/list-files?maxKeys=200');
      const data = await response.json();

      if (response.ok && data.files) {
        this.setState({
          existingFiles: data.files,
          loadingFiles: false,
          hasMore: data.isTruncated || false,
          nextContinuationToken: data.nextContinuationToken,
        });
      } else {
        this.setState({
          loadingFiles: false,
          existingFiles: [],
          error: 'Failed to load R2 files',
        });
      }
    } catch (error) {
      console.error('Failed to load R2 files from API:', error);
      this.setState({
        loadingFiles: false,
        existingFiles: [],
        error: 'Failed to load R2 files',
      });
    }
  },

  async loadMoreFiles() {
    const { nextContinuationToken } = this.state;
    if (!nextContinuationToken) return;

    this.setState({ loadingMore: true, error: null });

    try {
      const url = `/api/r2/list-files?maxKeys=200&continuationToken=${encodeURIComponent(nextContinuationToken)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok && data.files) {
        this.setState(prevState => ({
          existingFiles: [...prevState.existingFiles, ...data.files],
          hasMore: data.isTruncated,
          nextContinuationToken: data.nextContinuationToken,
          loadingMore: false,
        }));
      } else {
        this.setState({ loadingMore: false, error: 'Failed to load more files' });
      }
    } catch (error) {
      this.setState({ loadingMore: false, error: error.message });
    }
  },

  determineFileType(file) {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    // Everything goes to R2, but we categorize for folder routing
    if (isVideo) return 'video';
    if (isImage) return 'image';
    return 'unknown';
  },

  async uploadToR2(file) {
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
      throw new Error(errorData.error || 'Failed to get upload URL');
    }

    const { presignedUrl, publicUrl } = await presignResponse.json();

    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file to R2: ${uploadResponse.status}`);
    }

    return publicUrl;
  },


  async uploadToGit(file) {
    // Use Decap's onPersistMedia method - this is the correct prop for uploading media
    return new Promise(async (resolve, reject) => {
      try {
        // onPersistMedia is the correct prop for handling media uploads
        if (this.props.onPersistMedia) {
          const result = await this.props.onPersistMedia(file);

          // onPersistMedia returns a Redux action with payload
          if (result && result.payload) {
            const payload = result.payload;

            // The payload should contain the file info with path
            if (payload.path) {
              // Transform static/uploads/file.jpg -> /uploads/file.jpg
              const publicPath = payload.path.replace(/^static/, '');
              resolve(publicPath);
              return;
            }

            // Some backends return public_path
            if (payload.public_path) {
              const publicPath = payload.public_path.replace(/^static/, '');
              resolve(publicPath);
              return;
            }

            // If payload is the file object itself, it might have file property
            if (payload.file && payload.file.path) {
              const publicPath = payload.file.path.replace(/^static/, '');
              resolve(publicPath);
              return;
            }
          }

          // Result should be a media file object with path (direct format)
          if (result && result.path) {
            const publicPath = result.path.replace(/^static/, '');
            resolve(publicPath);
            return;
          }
          if (typeof result === 'string') {
            // Also transform if it's a string path
            const publicPath = result.replace(/^static/, '');
            resolve(publicPath);
            return;
          }
        }

        // Fallback: Try the backend directly
        const backend = window.CMS?.getBackend?.();

        if (backend && backend.persistMedia) {
          const persistedMedia = await backend.persistMedia(file);

          if (persistedMedia && persistedMedia.path) {
            resolve(persistedMedia.path);
            return;
          }
          if (typeof persistedMedia === 'string') {
            resolve(persistedMedia);
            return;
          }
        }

        // If we get here, none of the methods worked
        const error = new Error('Git backend integration not available. Falling back to R2.');
        reject(error);
      } catch (error) {
        reject(error);
      }
    });
  },

  async handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileType = this.determineFileType(file);
    const fileSize = file.size;

    this.setState({
      uploading: true,
      error: null,
      uploadProgress: 0,
      fileType
    });

    try {
      let finalUrl;

      // Decision logic: Videos or large images (>25MB) → R2, small images → Git
      const shouldUseR2 = fileType === 'video' || fileSize > LARGE_FILE_THRESHOLD;

      if (shouldUseR2) {
        finalUrl = await this.uploadToR2(file);

        // Refresh R2 file list
        setTimeout(() => this.loadExistingFiles(), 1000);
      } else {
        try {
          finalUrl = await this.uploadToGit(file);
        } catch (gitError) {
          // Fallback to R2 if Git upload fails
          finalUrl = await this.uploadToR2(file);
          setTimeout(() => this.loadExistingFiles(), 1000);
        }
      }

      this.setState({
        value: finalUrl,
        uploading: false,
        uploadProgress: 100,
        error: null,
      });

      this.props.onChange(finalUrl);
    } catch (error) {
      this.setState({
        uploading: false,
        uploadProgress: 0,
        error: error.message || 'Upload failed. Please try again.',
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

  handleFileTypeChange(type) {
    this.setState({ selectedFileType: type });
  },

  handleDateFilterChange(filter) {
    this.setState({ dateFilter: filter });
  },

  handleClearFilters() {
    this.setState({
      searchQuery: '',
      selectedFileType: 'all',
      dateFilter: 'all',
    });
  },

  getFilteredFiles() {
    const { existingFiles, searchQuery, selectedFileType, dateFilter } = this.state;
    let filtered = existingFiles;

    // Filter by file type
    if (selectedFileType === 'images') {
      filtered = filtered.filter(file => file.isImage);
    } else if (selectedFileType === 'videos') {
      filtered = filtered.filter(file => file.isVideo);
    }

    // Filter by date range
    if (dateFilter !== 'all') {
      const now = new Date();
      const days = dateFilter === '7days' ? 7 : dateFilter === '30days' ? 30 : 90;
      const cutoffDate = new Date(now - days * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(file => new Date(file.lastModified) >= cutoffDate);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(file =>
        file.key.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  },

  renderUploadTab() {
    const { uploading, uploadProgress, error, fileType } = this.state;

    return window.h(
      'div',
      { style: { padding: '16px' } },

      // Info box
      window.h(
        'div',
        {
          style: {
            padding: '12px',
            background: '#e3f2fd',
            border: '1px solid #90caf9',
            borderRadius: '5px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#1976d2',
          },
        },
        window.h('strong', {}, 'Smart Media Upload: '),
        'Videos and large images (>25MB) upload to Cloudflare R2. Small images (<25MB) are stored in Git.'
      ),

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
          fileType === 'video' ? 'Uploading video to R2...' :
          fileType === 'image' ? 'Uploading image...' :
          'Uploading...'
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
          },
        },
        error
      )
    );
  },

  renderBrowseTab() {
    const { existingFiles, loadingFiles, searchQuery } = this.state;
    const filteredFiles = this.getFilteredFiles();

    return window.h(
      'div',
      { style: { padding: '16px' } },

      // Info
      window.h(
        'div',
        { style: { fontSize: '13px', color: '#798291', marginBottom: '16px' } },
        'Browse R2 files (videos and large images)'
      ),

      // File type filter
      window.h(
        'div',
        { style: { marginBottom: '12px' } },
        window.h('div', { style: { fontSize: '12px', fontWeight: '500', color: '#798291', marginBottom: '6px' } }, 'File Type'),
        window.h(
          'div',
          { style: { display: 'flex', gap: '8px' } },
          ['all', 'images', 'videos'].map(type =>
            window.h(
              'button',
              {
                key: type,
                onClick: () => this.handleFileTypeChange(type),
                style: {
                  padding: '6px 12px',
                  border: '1px solid #dfdfe3',
                  borderRadius: '4px',
                  background: this.state.selectedFileType === type ? '#3b82f6' : '#fff',
                  color: this.state.selectedFileType === type ? '#fff' : '#798291',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                },
              },
              type === 'all' ? 'All Files' : type
            )
          )
        )
      ),

      // Date range filter
      window.h(
        'div',
        { style: { marginBottom: '12px' } },
        window.h('div', { style: { fontSize: '12px', fontWeight: '500', color: '#798291', marginBottom: '6px' } }, 'Date Range'),
        window.h(
          'select',
          {
            value: this.state.dateFilter,
            onChange: (e) => this.handleDateFilterChange(e.target.value),
            style: {
              width: '100%',
              padding: '6px 12px',
              border: '1px solid #dfdfe3',
              borderRadius: '4px',
              fontSize: '13px',
            },
          },
          window.h('option', { value: 'all' }, 'All Time'),
          window.h('option', { value: '7days' }, 'Last 7 Days'),
          window.h('option', { value: '30days' }, 'Last 30 Days'),
          window.h('option', { value: '90days' }, 'Last 90 Days')
        )
      ),

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

      // Active filters chips
      (this.state.searchQuery || this.state.selectedFileType !== 'all' || this.state.dateFilter !== 'all') && window.h(
        'div',
        { style: { marginBottom: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '12px', alignItems: 'center' } },
        window.h('span', { style: { color: '#798291' } }, 'Filters:'),
        this.state.selectedFileType !== 'all' && window.h(
          'span',
          { style: { padding: '4px 8px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '3px', color: '#1976d2' } },
          `Type: ${this.state.selectedFileType}`
        ),
        this.state.dateFilter !== 'all' && window.h(
          'span',
          { style: { padding: '4px 8px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '3px', color: '#1976d2' } },
          `Date: ${this.state.dateFilter.replace('days', ' days')}`
        ),
        this.state.searchQuery && window.h(
          'span',
          { style: { padding: '4px 8px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '3px', color: '#1976d2' } },
          `Search: "${this.state.searchQuery}"`
        ),
        window.h(
          'button',
          {
            onClick: () => this.handleClearFilters(),
            style: { padding: '4px 8px', background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' },
          },
          'Clear all'
        )
      ),

      // Loading state
      loadingFiles && window.h(
        'div',
        { style: { textAlign: 'center', padding: '24px', color: '#798291' } },
        'Loading files...'
      ),

      // Results count
      !loadingFiles && window.h(
        'div',
        { style: { fontSize: '13px', color: '#798291', marginBottom: '12px' } },
        `Showing ${filteredFiles.length} of ${this.state.existingFiles.length} files${this.state.hasMore ? ' (more available)' : ''}`
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
                    { style: { fontSize: '32px', color: '#798291' } },
                    file.isVideo ? '▶️' : '📄'
                  )
            ),

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

      // Load More button
      this.state.hasMore && !loadingFiles && filteredFiles.length > 0 && window.h(
        'div',
        { style: { marginTop: '16px', textAlign: 'center' } },
        window.h(
          'button',
          {
            onClick: () => this.loadMoreFiles(),
            disabled: this.state.loadingMore,
            style: {
              padding: '10px 24px',
              border: '1px solid #3b82f6',
              borderRadius: '5px',
              background: this.state.loadingMore ? '#e0e0e0' : '#fff',
              color: this.state.loadingMore ? '#798291' : '#3b82f6',
              fontSize: '14px',
              fontWeight: '500',
              cursor: this.state.loadingMore ? 'not-allowed' : 'pointer',
            },
          },
          this.state.loadingMore ? 'Loading...' : 'Load More Files'
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
            tab === 'upload' ? 'Upload New' : 'Browse R2'
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
          placeholder: 'Upload a file or enter URL...',
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

const SmartMediaPreview = window.createClass({
  render() {
    const { value } = this.props;

    // Handle non-string values safely
    const valueStr = typeof value === 'string' ? value : (value?.path || value?.url || '');

    if (!valueStr) {
      return window.h(
        'div',
        { style: { color: '#798291', fontSize: '14px', padding: '8px' } },
        'No media selected'
      );
    }

    const isImage = isImagePath(valueStr);
    const isVideo = isVideoPath(valueStr);
    const isR2 = valueStr.includes('assets.mikegrunwald.com') || valueStr.includes('r2.cloudflarestorage.com');

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
              src: valueStr,
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

      // Storage info
      window.h(
        'div',
        {
          style: {
            fontSize: '11px',
            color: '#798291',
            marginBottom: '4px',
            fontWeight: '500',
          },
        },
        isR2 ? '☁️ Stored in R2' : '📁 Stored in Git'
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
        valueStr
      )
    );
  },
});

// Register the widget
window.CMS.registerWidget('smart-media', SmartMediaControl, SmartMediaPreview);
