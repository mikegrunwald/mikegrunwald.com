// Custom Link Widget for Decap CMS
// Provides a structured input for links with label and URL fields

const LinkControl = window.createClass({
  getInitialState() {
    const value = this.props.value;
    return {
      label: value?.label || '',
      url: value?.url || ''
    };
  },

  componentDidMount() {
    // If there's an initial value, sync it
    if (this.props.value) {
      this.setState({
        label: this.props.value.label || '',
        url: this.props.value.url || ''
      });
    }
  },

  handleLabelChange(e) {
    const label = e.target.value;
    this.setState({ label });
    this.updateValue({ label, url: this.state.url });
  },

  handleUrlChange(e) {
    const url = e.target.value;
    this.setState({ url });
    this.updateValue({ label: this.state.label, url });
  },

  updateValue(value) {
    this.props.onChange(value);
  },

  isValidUrl(string) {
    if (!string) return false;
    try {
      new URL(string);
      return true;
    } catch (_) {
      // Check if it's a relative URL
      if (string.startsWith('/') || string.startsWith('./') || string.startsWith('../')) {
        return true;
      }
      return false;
    }
  },

  render() {
    const { forID, classNameWrapper } = this.props;
    const { label, url } = this.state;

    const isUrlValid = !url || this.isValidUrl(url);
    const hasErrors = !isUrlValid;

    return window.h(
      'div',
      { className: classNameWrapper },
      window.h(
        'div',
        { style: { marginBottom: '12px' } },
        window.h(
          'label',
          { htmlFor: `${forID}-label`, style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' } },
          'Label *'
        ),
        window.h('input', {
          id: `${forID}-label`,
          type: 'text',
          value: label,
          onChange: this.handleLabelChange,
          placeholder: 'Enter link label',
          required: true,
          style: {
            width: '100%',
            padding: '8px',
            border: '1px solid #dfdfe3',
            borderRadius: '5px',
            fontSize: '15px',
            fontFamily: 'inherit'
          }
        })
      ),
      window.h(
        'div',
        { style: { marginBottom: '12px' } },
        window.h(
          'label',
          { htmlFor: `${forID}-url`, style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' } },
          'URL *'
        ),
        window.h('input', {
          id: `${forID}-url`,
          type: 'url',
          value: url,
          onChange: this.handleUrlChange,
          placeholder: 'https://example.com',
          required: true,
          style: {
            width: '100%',
            padding: '8px',
            border: hasErrors ? '1px solid #ff3b30' : '1px solid #dfdfe3',
            borderRadius: '5px',
            fontSize: '15px',
            fontFamily: 'inherit'
          }
        }),
        !isUrlValid && window.h(
          'p',
          { style: { color: '#ff3b30', fontSize: '12px', marginTop: '4px', marginBottom: '0' } },
          'Please enter a valid URL'
        )
      )
    );
  }
});

const LinkPreview = window.createClass({
  render() {
    const { value } = this.props;

    if (!value || (!value.label && !value.url)) {
      return window.h('div', { style: { color: '#798291', fontSize: '14px' } }, 'No link configured');
    }

    return window.h(
      'div',
      { style: { fontSize: '14px' } },
      window.h('strong', {}, value.label || 'Untitled'),
      value.url && window.h(
        'div',
        { style: { color: '#798291', fontSize: '12px', marginTop: '2px' } },
        value.url
      )
    );
  }
});

// Register the widget
window.CMS.registerWidget('link', LinkControl, LinkPreview);
