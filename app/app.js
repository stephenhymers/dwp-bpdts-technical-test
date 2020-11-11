const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const nunjucks = require('nunjucks')
const path = require('path')

const helperFunctions = require('../lib/helper-functions')
const fileHelper = require('../lib/file-helper')
const configPaths = require('../config/paths.json')

// Set up views
const appViews = [
  configPaths.layouts,
  configPaths.views,
  configPaths.fullPageExamples,
  configPaths.components,
  configPaths.src,
  configPaths.node_modules
]

module.exports = (options) => {
  const nunjucksOptions = options ? options.nunjucks : {}

  // Configure nunjucks
  const env = nunjucks.configure(appViews, {
    autoescape: true, // output with dangerous characters are escaped automatically
    express: app, // the express app that nunjucks should install to
    noCache: true, // never use a cache and recompile templates each time
    trimBlocks: true, // automatically remove trailing newlines from a block/tag
    lstripBlocks: true, // automatically remove leading whitespace from a block/tag
    watch: true, // reload templates when they are changed. needs chokidar dependency to be installed
    ...nunjucksOptions // merge any additional options and overwrite defaults above.
  })

  // make the function available as a filter for all templates
  env.addFilter('componentNameToMacroName', helperFunctions.componentNameToMacroName)
  env.addGlobal('markdown', require('marked'))

  // Set view engine
  app.set('view engine', 'njk')

  // Disallow search index indexing
  app.use(function (req, res, next) {
    // none - Equivalent to noindex, nofollow
    // noindex - Do not show this page in search results and do not show a
    //   "Cached" link in search results.
    // nofollow - Do not follow the links on this page
    res.setHeader('X-Robots-Tag', 'none')
    next()
  })

  // Set up middleware to serve static assets
  app.use('/public', express.static(configPaths.public))

  // serve html5-shiv from node modules
  app.use('/vendor/html5-shiv/', express.static('node_modules/html5shiv/dist/'))

  // serve legacy code from node modules
  app.use('/vendor/govuk_template/', express.static('node_modules/govuk_template_jinja/assets/'))
  app.use('/vendor/govuk_frontend_toolkit/assets', express.static('node_modules/govuk_frontend_toolkit/images'))
  app.use('/vendor/govuk_frontend_toolkit/', express.static('node_modules/govuk_frontend_toolkit/javascripts/govuk/'))
  app.use('/vendor/jquery/', express.static('node_modules/jquery/dist'))

  app.use('/assets', express.static(path.join(configPaths.src, 'assets')))

  // Turn form POSTs into data that can be used for validation.
  app.use(bodyParser.urlencoded({ extended: true }))

  // Handle the banner component serverside.
  require('./banner.js')(app)

  // Define middleware for all routes
  app.use('*', function (request, response, next) {
    response.locals.legacy = (request.query.legacy === '1' || request.query.legacy === 'true')
    if (response.locals.legacy) {
      response.locals.legacyQuery = '?legacy=' + request.query.legacy
    } else {
      response.locals.legacyQuery = ''
    }
    next()
  })

  // Define routes

  // Index page - render the component list template
  app.get('/', async function (req, res) {
    const fullPageExamples = fileHelper.fullPageExamples()

    res.render('index', {
      fullPageExamples: fullPageExamples
    })
  })

  // Full page example views
  require('./full-page-examples.js')(app)

  app.get('/robots.txt', function (req, res) {
    res.type('text/plain')
    res.send('User-agent: *\nDisallow: /')
  })

  return app
}
