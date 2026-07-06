// For more information about this file see https://dove.feathersjs.com/guides/cli/hook.html
import { GeneralError, NotAuthenticated, Forbidden } from '@feathersjs/errors';
import { preventChanges, setField } from 'feathers-hooks-common';
import NodeCache from 'node-cache'

// Initialize roles cache with 5 minutes TTL
const rolesCache = new NodeCache({ stdTTL: 300 })

interface Role {
	name: string;
	permissions: Array<{ rule: string }>;
}

export const accessControl = (...methods: string[]) => {
	return async (context: any, next: any) => {
		context.accessControl = { required: false }
		const { path, method, params: { authentication, provider, user } } = context;

		if (authentication?.strategy == 'anonymous') {
			context.accessControl = { anonymous: true }
		}
		if (!provider) {
			context.accessControl.permitted = true;
		} else if ((methods.length == 0 || methods.includes(method)) && provider) {
			context.accessControl.required = true;
			context.accessControl.requiredPermissions = [`*`, `*:${method}`, `${path}:*`, `${path}:${method}`];
			
			// Check if anonymous access is allowed
			if (context.accessControl.anonymous) {
				// For anonymous users, we'll let the resolver decide based on the mode
				context.accessControl.permitted = false; // Will be overridden by resolver
			} else {
				// For authenticated users, check role-based permissions
				let roles = rolesCache.get('all') as Role[] | undefined;
				if (!roles) {
					const { data } = await context.app.service('roles').find({
						query: {}
					});
					roles = data;
					rolesCache.set('all', roles);
				}
				
				let permitted = false;
				const userRoles = user?.roles || [];
				for (let role of (roles || []).filter((r: Role) => userRoles.includes(r.name))) {
					for (let permission of role.permissions) {
						if (context.accessControl.requiredPermissions.includes(permission.rule)) {
							permitted = true;
							break;
						}
					}
				}
				
				context.accessControl.permitted = permitted;
			}
		}
		await next();
	}
}

export const accessControlResolver = (
	options: any,
    defaults: any = {
		mode: 'restrictToUser',
		restrictToUserFrom: 'params.user._id',
		restrictToUserAs: 'params.query.userId'
	}
) => {
	const { mode, restrictToUserFrom, restrictToUserAs } = { ...defaults, ...options };
	
	return async (context: any) => {
		const { path, method, accessControl: { required = false, permitted = false, anonymous = false }, params: { user } } = context;
		
		// Skip access control if not required or already permitted
		if (!required || permitted) {
			return;
		}

		if (typeof mode === 'function') {
			context.accessControl.resolverMode = 'function';
			return mode(context)
		} else {
			context.accessControl.resolverMode = mode;
			switch(mode)
			{
				case 'restrictToUser':
					// For restrictToUser mode, we need an authenticated user
					if (!user) {
						throw new NotAuthenticated('Authentication required');
					}
					setField({
						from: restrictToUserFrom,
						as: restrictToUserAs
					})(context);
					break;
				case 'forbidden': 
					throw new Forbidden(`Missing required permissions to ${method} ${path}`);
					break;
				case 'ignore': 
					context.accessControl.ignored = true;
					break;
				default: 
					throw new GeneralError('Invalid `mode` in accessControlResolver');
			}
		}
	}
}

export const allowAnonymous = async (context: any, next: any) => {
	const { params } = context

	if (params.provider && !params.authentication) {
		context.params = {
			...params,
			authentication: {
				strategy: 'anonymous'
			}
		}
	}

	await next()

	return context
} 