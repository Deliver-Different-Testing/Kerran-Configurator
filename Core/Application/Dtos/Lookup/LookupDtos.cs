using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Lookup
{
    public class ClientLookupDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Code { get; set; }
    }

    public class ServiceLookupDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Code { get; set; }
    }

    public class ClientsResponse : BaseResponse
    {
        public ClientsResponse(Guid messageId) : base(messageId) { }
        public List<ClientLookupDto> Clients { get; set; } = new();
    }

    public class ServicesResponse : BaseResponse
    {
        public ServicesResponse(Guid messageId) : base(messageId) { }
        public List<ServiceLookupDto> Services { get; set; } = new();
    }

    public class SiteLookupDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
    }

    public class RegionLookupDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
    }

    public class SitesResponse : BaseResponse
    {
        public SitesResponse(Guid messageId) : base(messageId) { }
        public List<SiteLookupDto> Sites { get; set; } = new();
    }

    public class RegionsResponse : BaseResponse
    {
        public RegionsResponse(Guid messageId) : base(messageId) { }
        public List<RegionLookupDto> Regions { get; set; } = new();
    }
}
