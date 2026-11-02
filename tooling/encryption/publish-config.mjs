export function publishingConfig(value) {
  const mode = value || 'encrypted';
  if (!['static','encrypted'].includes(mode)) {
    throw Error('PROTOTYPE_PUBLISH_MODE must be static or encrypted. Deployment stopped.');
  }
  return {
    mode,
    command: mode === 'encrypted' ? 'build:encrypted' : 'build',
    directory: mode === 'encrypted' ? '_encrypted' : '_site'
  };
}
