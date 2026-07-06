import { app } from './app'

const port = app.get('port')
const host = app.get('host')

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection', reason)
})

app.listen(port).then(() => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://${host}:${port}`)
})
