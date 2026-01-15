const Definition = require('@npmcli/config/lib/definitions/definition.js')
const globalDefinitions = require('@npmcli/config/lib/definitions/definitions.js')
const TrustCommand = require('../../trust-cmd.js')

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class TrustCircleCI extends TrustCommand {
  static description = 'Create a trusted relationship between a package and CircleCI'
  static name = 'circleci'
  static positionals = 1 // expects at most 1 positional (package name)
  static providerName = 'CircleCI'
  static providerEntity = 'CircleCI pipeline'

  static usage = [
    '[package] --org-id <uuid> --pipeline-definition-id <uuid> --vcs-origin <origin> [--context-id <uuid>] [-y|--yes]',
  ]

  static definitions = {
    yes: globalDefinitions.yes,
    json: globalDefinitions.json,
    'dry-run': globalDefinitions['dry-run'],
    'org-id': new Definition('org-id', {
      default: null,
      type: String,
      description: 'CircleCI organization UUID',
    }),
    'pipeline-definition-id': new Definition('pipeline-definition-id', {
      default: null,
      type: String,
      description: 'CircleCI pipeline definition UUID',
    }),
    'vcs-origin': new Definition('vcs-origin', {
      default: null,
      type: String,
      description: "CircleCI repository origin in format 'provider/owner/repo'",
    }),
    'context-id': new Definition('context-id', {
      default: null,
      type: String,
      description: 'CircleCI context UUID',
    }),
  }

  validateUuid (value, fieldName) {
    if (!UUID_REGEX.test(value)) {
      throw new Error(`${fieldName} must be a valid UUID`)
    }
  }

  validateVcsOrigin (value) {
    // Expected format: provider/owner/repo (e.g., github.com/owner/repo, bitbucket.org/owner/repo)
    const parts = value.split('/')
    if (parts.length < 3) {
      throw new Error("vcs-origin must be in format 'provider/owner/repo'")
    }
  }

  // Generate a URL from vcs-origin (e.g., github.com/npm/repo -> https://github.com/npm/repo)
  getVcsOriginUrl (vcsOrigin) {
    if (!vcsOrigin) {
      return null
    }
    // vcs-origin format: github.com/owner/repo or bitbucket.org/owner/repo
    return `https://${vcsOrigin}`
  }

  static optionsToBody (options) {
    const { orgId, pipelineDefinitionId, vcsOrigin, contextId } = options
    const trustConfig = {
      type: 'circleci',
      claims: {
        org_id: orgId,
        pipeline_definition_id: pipelineDefinitionId,
        vcs_origin: vcsOrigin,
      },
    }
    if (contextId) {
      trustConfig.claims.context_id = contextId
    }
    return trustConfig
  }

  static bodyToOptions (body) {
    return {
      ...(body.id) && { id: body.id },
      ...(body.type) && { type: body.type },
      ...(body.claims?.org_id) && { orgId: body.claims.org_id },
      ...(body.claims?.pipeline_definition_id) && {
        pipelineDefinitionId: body.claims.pipeline_definition_id,
      },
      ...(body.claims?.vcs_origin) && { vcsOrigin: body.claims.vcs_origin },
      ...(body.claims?.context_id) && { contextId: body.claims.context_id },
    }
  }

  // Override flagsToOptions since CircleCI doesn't use file/entity pattern
  async flagsToOptions ({ positionalArgs, flags }) {
    const content = await this.optionalPkgJson()
    const pkgName = positionalArgs[0] || content.name

    if (!pkgName) {
      throw new Error('Package name must be specified either as an argument or in package.json file')
    }

    const orgId = flags['org-id']
    const pipelineDefinitionId = flags['pipeline-definition-id']
    const vcsOrigin = flags['vcs-origin']
    const contextId = flags['context-id']

    // Validate required flags
    if (!orgId) {
      throw new Error('org-id is required')
    }
    if (!pipelineDefinitionId) {
      throw new Error('pipeline-definition-id is required')
    }
    if (!vcsOrigin) {
      throw new Error('vcs-origin is required')
    }

    // Validate formats
    this.validateUuid(orgId, 'org-id')
    this.validateUuid(pipelineDefinitionId, 'pipeline-definition-id')
    this.validateVcsOrigin(vcsOrigin)
    if (contextId) {
      this.validateUuid(contextId, 'context-id')
    }

    return {
      values: {
        package: pkgName,
        orgId,
        pipelineDefinitionId,
        vcsOrigin,
        ...(contextId && { contextId }),
      },
      fromPackageJson: {},
      warnings: [],
      urls: {
        package: this.getFrontendUrl({ pkgName }),
        vcsOrigin: this.getVcsOriginUrl(vcsOrigin),
      },
    }
  }

  async exec (positionalArgs, flags) {
    await this.createConfigCommand({
      positionalArgs,
      flags,
    })
  }
}

module.exports = TrustCircleCI
