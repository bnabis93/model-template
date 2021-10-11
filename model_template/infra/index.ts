import * as pulumi from "@pulumi/pulumi"
import * as awsx from "@pulumi/awsx";
import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";
import TraefikRoute from "./TraefikRoute"

const config = new pulumi.Config()
// Create a repository.
const repo = new awsx.ecr.Repository("model-template");

// Build a Docker image from a local Dockerfile context in the
// './node-app' directory, and push it to the registry.
//const customImage = "node-app";
const appImage = repo.buildAndPushImage(`../`);


//Read base Pulumi projects
const baseStack = new pulumi.StackReference("bnabis93/build-ml-infra/dev")

// Create a k8s provider.
const provider = new k8s.Provider("provider", {
    kubeconfig: baseStack.getOutput("kubeconfig")
});

// Define the Pod for the Deployment.
const pb = new kx.PodBuilder({
    containers: [{
        image: appImage,
        ports: { "http": 80 },
        env:{
            "MLFLOW_TRACKING_URI" : "http://ml.aebono.com/mlflow",
            "MLFLOW_RUN_ID" : config.require("runID"),
        }
    }],
    serviceAccountName : baseStack.getOutput("modelServiceAccount")
});

// Create a Deployment of the Pod defined by the PodBuilder.
const appDeploymentKx = new kx.Deployment("app-kx", {
    spec: pb.asDeploymentSpec(),
}, { provider: provider });

const service = appDeploymentKx.createService();

//Expose MLFlow in Traefik as /mlflow 
new TraefikRoute('model-template-route', {
    prefix: '/models/model-template',
    service: service,
    namespace: 'default',
  }, { provider: provider});