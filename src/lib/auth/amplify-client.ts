'use client'

import { Amplify } from 'aws-amplify'

const amplifyConfigured = { value: false }

export function hasAmplifyCognitoConfig(): boolean {
    return Boolean(
        process.env.NEXT_PUBLIC_AWS_COGNITO_REGION &&
        process.env.NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID &&
        process.env.NEXT_PUBLIC_AWS_COGNITO_USER_POOL_CLIENT_ID
    )
}

export function ensureAmplifyConfigured() {
    if (amplifyConfigured.value) {
        return
    }

    if (!hasAmplifyCognitoConfig()) {
        return
    }

    Amplify.configure({
        Auth: {
            Cognito: {
                userPoolId: process.env.NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID!,
                userPoolClientId: process.env.NEXT_PUBLIC_AWS_COGNITO_USER_POOL_CLIENT_ID!,
            },
        },
    })

    amplifyConfigured.value = true
}
