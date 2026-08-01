import { NextResponse } from "next/server";
export async function GET(){return NextResponse.json({readyForExtension:true,providerConfigured:false,architecture:["provider-contract","retrieval-contract","auth-before-retrieval","worker-ready"]})}
