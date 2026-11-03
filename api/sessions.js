let handler;
module.exports = async function sessions(req, res) {
  handler ||= (await import('../server/handler.mjs')).makeHandler();
  return handler(req, res);
};
