# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app.

See http://www.cafjs.com 

## CAF Registry proxy

[![Build Status](http://ci.cafjs.com/github.com/cafjs/caf_registryproxy/status.svg?branch=master)](http://ci.cafjs.com/github.com/cafjs/caf_registryproxy)


This library provides a proxy for a Docker registry to perform authentication using the `accounts` service, and authorization by partitioning the image name space, i.e., you can only push images to `registry.cafjs.com/<your username>-<whatever>`. 

There are no private images at this point, any authenticated user can see all of them.


## API


    
 
## Configuration Example


